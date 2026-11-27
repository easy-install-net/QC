(function () {
  'use strict';

  var STORAGE_KEY = 'artisan_qc_reports_v1';
  var PASSCODE_KEY = 'artisan_qc_unlocked_v1';
  var DEFAULT_PASSCODE = ''; // 如需密碼鎖定可填寫，留空則預設不鎖定

  var state = {
    viewMode: 'schedule', // 'schedule' | 'reports'
    siteFilter: 'ALL',
    searchQuery: '',
    periodFrom: '',
    periodTo: '',
    editingId: null,
    reports: []
  };

  function seedDefaultReports() {
    return [
      {
        id: 'r-' + Date.now() + '-1',
        site: '屯門建生康生樓402室',
        assignee: 'Jackson',
        title: '現場睇位度尺',
        date: '',
        timeStart: '09:00',
        timeEnd: '11:00',
        periodLabel: '',
        isFutureDiary: true,
        summary: '現場睇位度尺',
        followup: '',
        attachments: [],
        photos: [],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'r-' + Date.now() + '-2',
        site: '屯門海翠2-19a',
        assignee: 'Rovena',
        title: '許生師傅夾石，順便記錄一下現場',
        date: '2026-11-25',
        timeStart: '10:00',
        timeEnd: '11:00',
        periodLabel: '11月25日(三)',
        isFutureDiary: false,
        summary: '許生師傅夾石，順便記錄一下現場',
        followup: '',
        attachments: [],
        photos: [],
        updatedAt: new Date().toISOString()
      }
    ];
  }

  function loadReports() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        var seeded = seedDefaultReports();
        saveReportsToStorage(seeded);
        return seeded;
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : seedDefaultReports();
    } catch (e) {
      return seedDefaultReports();
    }
  }

  function saveReportsToStorage(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // 忽略儲存空間上限錯誤
    }
  }

  function setSyncStatus(text) {
    var badge = document.getElementById('syncStatusBadge');
    if (badge) {
      badge.textContent = text;
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateDisplay(dateStr, periodLabel) {
    if (periodLabel) return periodLabel;
    if (!dateStr) return '未定日期';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var days = ['日', '一', '二', '三', '四', '五', '六'];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日(' + days[d.getDay()] + ')';
  }

  function getUniqueSites() {
    var set = {};
    state.reports.forEach(function (r) {
      if (r.site && String(r.site).trim()) {
        set[String(r.site).trim()] = true;
      }
    });
    return Object.keys(set);
  }

  function refreshSiteFilterOptions() {
    var select = document.getElementById('siteFilter');
    if (!select) return;
    var sites = getUniqueSites();
    var currentVal = state.siteFilter || 'ALL';

    var html = '<option value="ALL">全部單位</option>';
    sites.forEach(function (site) {
      var sel = site === currentVal ? ' selected' : '';
      html += '<option value="' + escapeHtml(site) + '"' + sel + '>' + escapeHtml(site) + '</option>';
    });
    select.innerHTML = html;

    if (currentVal !== 'ALL' && sites.indexOf(currentVal) === -1) {
      state.siteFilter = 'ALL';
      select.value = 'ALL';
    }
  }

  function getFilteredReports() {
    var q = (state.searchQuery || '').trim().toLowerCase();
    var site = state.siteFilter || 'ALL';

    return state.reports.filter(function (r) {
      if (site && site !== 'ALL' && r.site !== site) {
        return false;
      }
      if (state.periodFrom && r.date && r.date < state.periodFrom) {
        return false;
      }
      if (state.periodTo && r.date && r.date > state.periodTo) {
        return false;
      }
      if (q) {
        var hay = [
          r.site || '',
          r.assignee || '',
          r.title || '',
          r.summary || '',
          r.followup || '',
          r.date || ''
        ].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderAttachmentItem(att, reportId, idx) {
    var name = escapeHtml(att.name || att.url || '附件');
    var url = escapeHtml(att.url || '#');
    return (
      '<div class="attachment-row" style="padding:4px 0;border-bottom:1px dashed #E2E8F0;">' +
        '<div class="attachment-left-cluster">' +
          '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="btn-link">' + name + '</a>' +
          '<button type="button" onclick="replaceAttachment(\'' + escapeHtml(reportId) + '\',' + idx + ')" class="btn-secondary" style="padding:2px 6px;font-size:12px;">換檔</button>' +
          '<button type="button" onclick="removeAttachment(\'' + escapeHtml(reportId) + '\',' + idx + ')" class="btn-secondary" style="padding:2px 6px;font-size:12px;">✕</button>' +
        '</div>' +
        '<div class="attachment-right-actions">' +
          '<button type="button" onclick="shareRecord(\'' + escapeHtml(reportId) + '\')" class="btn-link">↗ 分享</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderRecordCard(r) {
    var dateText = formatDateDisplay(r.date, r.periodLabel);
    var timeRange = [r.timeStart, r.timeEnd].filter(Boolean).join(' - ');
    var futureBadge = r.isFutureDiary ? ' <span class="future-tag-pill">即將新單位</span>' : '';

    var attHtml = '';
    if (Array.isArray(r.attachments) && r.attachments.length > 0) {
      attHtml = '<div style="margin-top:6px;">' +
        r.attachments.map(function (a, i) { return renderAttachmentItem(a, r.id, i); }).join('') +
      '</div>';
    }

    var photoHtml = '';
    if (Array.isArray(r.photos) && r.photos.length > 0) {
      photoHtml = '<div class="photo-grid" style="margin-top:6px;">' +
        r.photos.map(function (src) {
          return '<img src="' + escapeHtml(src) + '" alt="現場相片" style="max-height:90px;border-radius:4px;object-fit:cover;" />';
        }).join('') +
      '</div>';
    }

    return (
      '<div class="report-card" data-site="' + escapeHtml(r.site) + '" style="background:#FFF;padding:10px 12px;margin-top:6px;border-left:3px solid ' + (r.isFutureDiary ? '#EA580C' : '#CBD5E1') + ';">' +
        '<div class="record-header-row">' +
          '<div class="record-left-cluster">' +
            '<span style="font-weight:700;color:' + (!r.date ? '#EA580C' : '#0F172A') + ';">' + escapeHtml(dateText) + '</span>' +
            (timeRange ? '<span class="t-meta muted">' + escapeHtml(timeRange) + '</span>' : '') +
            futureBadge +
          '</div>' +
          '<div class="record-right-actions">' +
            '<button type="button" onclick="shareRecord(\'' + escapeHtml(r.id) + '\')" class="btn-link">↗ 分享</button>' +
            '<button type="button" onclick="deleteReport(\'' + escapeHtml(r.id) + '\')" class="btn-link" style="color:#DC2626;">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="record-left-cluster" style="margin-top:6px;">' +
          '<button type="button" onclick="openEditor(\'' + escapeHtml(r.id) + '\')" class="btn-link">詳編</button>' +
          '<button type="button" onclick="addQuickNote(\'' + escapeHtml(r.id) + '\')" class="btn-link">留言</button>' +
          '<button type="button" onclick="splitRecord(\'' + escapeHtml(r.id) + '\')" class="btn-link">單分</button>' +
        '</div>' +
        (r.title || r.summary
          ? '<div style="margin-top:6px;font-size:13.5px;">' + escapeHtml(r.title || r.summary) + (r.title && r.summary && r.title !== r.summary ? ' — ' + escapeHtml(r.summary) : '') + '</div>'
          : '') +
        (r.followup ? '<div class="t-meta" style="margin-top:4px;color:#0369A1;">跟進：' + escapeHtml(r.followup) + '</div>' : '') +
        attHtml +
        photoHtml +
      '</div>'
    );
  }

  function renderMainView() {
    var container = document.getElementById('reportListContainer');
    if (!container) return;

    refreshSiteFilterOptions();
    var filtered = getFilteredReports();
    var sites = getUniqueSites();

    var unscheduled = filtered.filter(function (r) { return !r.date; });
    var scheduled = filtered.filter(function (r) { return !!r.date; });

    var html = '';

    // 展開時段列（套用、重設、↗ 分享）
    html +=
      '<div class="section-share-bar" style="background:#FFF;padding:6px 10px;margin-top:6px;">' +
        '<span class="t-meta muted">時段：</span>' +
        '<input type="date" id="periodFrom" value="' + escapeHtml(state.periodFrom) + '" class="input-ui" style="width:auto;padding:2px 6px;" />' +
        '<span class="t-meta muted">至</span>' +
        '<input type="date" id="periodTo" value="' + escapeHtml(state.periodTo) + '" class="input-ui" style="width:auto;padding:2px 6px;" />' +
        '<button type="button" onclick="applyPeriodFilter()" class="btn-secondary" style="padding:2px 8px;font-size:12px;">套用</button>' +
        '<button type="button" onclick="resetPeriodFilter()" class="btn-secondary" style="padding:2px 8px;font-size:12px;">重設</button>' +
        '<button type="button" onclick="shareSelectedArea(\'period\')" class="btn-link" style="margin-left:auto;">↗ 分享</button>' +
      '</div>';

    // 地址快速篩選列 + 頂部 ↗ 分享
    html +=
      '<div class="site-quick-bar">' +
        '<div class="row-between" style="margin-bottom:4px;">' +
          '<span class="t-meta" style="font-weight:700;">地址</span>' +
          '<button type="button" onclick="shareSelectedArea(\'top\')" class="btn-link">↗ 分享</button>' +
        '</div>' +
        '<div class="site-quick-list">' +
          '<button type="button" onclick="selectSiteChip(\'ALL\')" class="site-chip-btn' + (state.siteFilter === 'ALL' ? ' active' : '') + '">全部 (' + state.reports.length + ')</button>' +
          sites.map(function (s) {
            var count = state.reports.filter(function (item) { return item.site === s; }).length;
            return '<button type="button" onclick="selectSiteChip(\'' + escapeHtml(s) + '\')" class="site-chip-btn' + (state.siteFilter === s ? ' active' : '') + '">' + escapeHtml(s) + ' (' + count + ')</button>';
          }).join('') +
        '</div>' +
      '</div>';

    // 未定日期置頂區塊（含「＋加工作」與「分享」掣）
    html +=
      '<div class="future-diary-box">' +
        '<div class="future-diary-head">' +
          '<div class="row" style="gap:6px;">' +
            '<span style="font-weight:700;color:#C2410C;">未定日期</span>' +
            '<span class="t-meta muted">(' + unscheduled.length + ')</span>' +
          '</div>' +
          '<div class="section-share-bar">' +
            '<button type="button" onclick="openEditor(null, { forceUnscheduled: true })" class="btn-link">＋加工作</button>' +
            '<button type="button" onclick="shareSelectedArea(\'unscheduled\')" class="btn-link">↗ 分享</button>' +
          '</div>' +
        '</div>' +
        '<div class="future-diary-body">' +
          (unscheduled.length > 0
            ? unscheduled.map(renderRecordCard).join('')
            : '<div class="t-meta muted">暫無未定日期項目</div>') +
        '</div>' +
      '</div>';

    // 按單位分組顯示紀錄（單位操作掣靠左貼近單位名）
    var targetSites = state.siteFilter && state.siteFilter !== 'ALL' ? [state.siteFilter] : sites;
    if (targetSites.length === 0) {
      html += '<div style="background:#FFF;padding:14px;margin-top:8px;text-align:center;" class="muted">暫無符合條件嘅單位紀錄</div>';
    } else {
      targetSites.forEach(function (siteName) {
        var siteRecords = filtered.filter(function (r) { return r.site === siteName && !!r.date; });
        var sample = state.reports.find(function (r) { return r.site === siteName; }) || {};
        html +=
          '<div style="background:#FFF;padding:10px 12px;margin-top:8px;border-left:3px solid #EA580C;">' +
            '<div class="unit-header-row">' +
              '<div class="unit-left-cluster">' +
                '<span class="t-site" style="font-weight:700;">' + escapeHtml(siteName) + '</span>' +
                (sample.assignee ? '<span class="t-meta muted">' + escapeHtml(sample.assignee) + '</span>' : '') +
                '<button type="button" onclick="openEditor(null, { site: \'' + escapeHtml(siteName) + '\' })" class="btn-link">＋工作</button>' +
                '<button type="button" onclick="openAlbumPage(\'' + escapeHtml(siteName) + '\')" class="btn-link">📸 截圖</button>' +
                '<button type="button" onclick="openUnitRepair(\'' + escapeHtml(siteName) + '\')" class="btn-link" style="color:#DC2626;font-weight:700;">修繕</button>' +
              '</div>' +
            '</div>' +
            (siteRecords.length > 0
              ? siteRecords.map(renderRecordCard).join('')
              : '<div class="t-meta muted" style="margin-top:6px;">此單位暫無已排期紀錄</div>') +
          '</div>';
      });
    }

    container.innerHTML = html;
    setSyncStatus('連線正常 · 已同步');
  }

  // 全域事件與操作函式（供 HTML onclick 呼叫）
  window.switchMainView = function (mode) {
    state.viewMode = mode === 'reports' ? 'reports' : 'schedule';
    var tSched = document.getElementById('tabSchedule');
    var tRep = document.getElementById('tabReports');
    if (tSched) tSched.classList.toggle('active', state.viewMode === 'schedule');
    if (tRep) tRep.classList.toggle('active', state.viewMode === 'reports');
    renderMainView();
  };

  window.onSiteFilterChange = function () {
    var el = document.getElementById('siteFilter');
    state.siteFilter = el ? el.value : 'ALL';
    renderMainView();
  };

  window.selectSiteChip = function (site) {
    state.siteFilter = site || 'ALL';
    renderMainView();
  };

  window.onSearchInput = function () {
    var el = document.getElementById('searchInput');
    state.searchQuery = el ? el.value : '';
    renderMainView();
  };

  window.applyPeriodFilter = function () {
    var fromEl = document.getElementById('periodFrom');
    var toEl = document.getElementById('periodTo');
    state.periodFrom = fromEl ? fromEl.value : '';
    state.periodTo = toEl ? toEl.value : '';
    renderMainView();
  };

  window.resetPeriodFilter = function () {
    state.periodFrom = '';
    state.periodTo = '';
    renderMainView();
  };

  window.openEditor = function (reportId, preset) {
    var modal = document.getElementById('editorModal');
    if (!modal) return;
    state.editingId = reportId || null;

    var titleEl = document.getElementById('editorModalTitle');
    var siteEl = document.getElementById('fieldSite');
    var assigneeEl = document.getElementById('fieldAssignee');
    var headTitleEl = document.getElementById('fieldTitle');
    var dateEl = document.getElementById('fieldDate');
    var startEl = document.getElementById('fieldTimeStart');
    var endEl = document.getElementById('fieldTimeEnd');
    var futureEl = document.getElementById('fieldIsFutureDiary');
    var summaryEl = document.getElementById('fieldSummary');
    var followupEl = document.getElementById('fieldFollowup');

    var existing = reportId ? state.reports.find(function (r) { return r.id === reportId; }) : null;

    if (titleEl) titleEl.textContent = existing ? '編輯單位紀錄' : '＋即將新單位';
    if (siteEl) siteEl.value = existing ? (existing.site || '') : ((preset && preset.site) || (state.siteFilter !== 'ALL' ? state.siteFilter : ''));
    if (assigneeEl) assigneeEl.value = existing ? (existing.assignee || '') : '';
    if (headTitleEl) headTitleEl.value = existing ? (existing.title || '') : '';
    if (dateEl) dateEl.value = existing ? (existing.date || '') : ((preset && preset.forceUnscheduled) ? '' : '');
    if (startEl) startEl.value = existing ? (existing.timeStart || '09:00') : '09:00';
    if (endEl) endEl.value = existing ? (existing.timeEnd || '') : '';
    if (futureEl) futureEl.checked = existing ? !!existing.isFutureDiary : !!(preset && preset.forceUnscheduled);
    if (summaryEl) summaryEl.value = existing ? (existing.summary || '') : '';
    if (followupEl) followupEl.value = existing ? (existing.followup || '') : '';

    modal.classList.remove('hidden');
  };

  window.closeEditor = function () {
    var modal = document.getElementById('editorModal');
    if (modal) modal.classList.add('hidden');
    state.editingId = null;
  };

  window.saveReport = function () {
    if (typeof window.syncEndTimeFromDuration === 'function') {
      window.syncEndTimeFromDuration();
    }
    var site = ((document.getElementById('fieldSite') || {}).value || '').trim();
    var title = ((document.getElementById('fieldTitle') || {}).value || '').trim();
    var summary = ((document.getElementById('fieldSummary') || {}).value || '').trim();

    if (!site) {
      alert('請填寫屋苑 / 單位名稱');
      return;
    }

    var recordData = {
      id: state.editingId || ('r-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
      site: site,
      assignee: ((document.getElementById('fieldAssignee') || {}).value || '').trim(),
      title: title || summary || site,
      date: ((document.getElementById('fieldDate') || {}).value || '').trim(),
      timeStart: ((document.getElementById('fieldTimeStart') || {}).value || '').trim(),
      timeEnd: ((document.getElementById('fieldTimeEnd') || {}).value || '').trim(),
      periodLabel: '',
      isFutureDiary: !!((document.getElementById('fieldIsFutureDiary') || {}).checked),
      summary: summary || title,
      followup: ((document.getElementById('fieldFollowup') || {}).value || '').trim(),
      attachments: [],
      photos: [],
      updatedAt: new Date().toISOString()
    };

    if (state.editingId) {
      var idx = state.reports.findIndex(function (r) { return r.id === state.editingId; });
      if (idx !== -1) {
        recordData.attachments = state.reports[idx].attachments || [];
        recordData.photos = state.reports[idx].photos || [];
        state.reports[idx] = recordData;
      } else {
        state.reports.unshift(recordData);
      }
    } else {
      state.reports.unshift(recordData);
    }

    saveReportsToStorage(state.reports);
    window.closeEditor();
    renderMainView();
  };

  window.deleteReport = function (id) {
    if (!confirm('確定要刪除此條紀錄嗎？')) return;
    state.reports = state.reports.filter(function (r) { return r.id !== id; });
    saveReportsToStorage(state.reports);
    renderMainView();
  };

  window.addQuickNote = function (id) {
    var target = state.reports.find(function (r) { return r.id === id; });
    if (!target) return;
    var note = prompt('輸入留言 / 跟進內容：', target.followup || '');
    if (note === null) return;
    target.followup = note.trim();
    target.updatedAt = new Date().toISOString();
    saveReportsToStorage(state.reports);
    renderMainView();
  };

  window.splitRecord = function (id) {
    var target = state.reports.find(function (r) { return r.id === id; });
    if (!target) return;
    var copy = Object.assign({}, target, {
      id: 'r-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: (target.title || '') + '（單分）',
      updatedAt: new Date().toISOString()
    });
    state.reports.unshift(copy);
    saveReportsToStorage(state.reports);
    renderMainView();
  };

  window.addDocRow = function () {
    var box = document.getElementById('docRowsContainer');
    if (!box) return;
    var row = document.createElement('div');
    row.className = 'row';
    row.style.gap = '6px';
    row.innerHTML =
      '<input type="text" class="input-ui" placeholder="文件名稱" style="flex:1;" />' +
      '<input type="url" class="input-ui" placeholder="https://..." style="flex:2;" />';
    box.appendChild(row);
  };

  window.replaceAttachment = function (reportId, idx) {
    var r = state.reports.find(function (item) { return item.id === reportId; });
    if (!r || !r.attachments || !r.attachments[idx]) return;
    var nextUrl = prompt('輸入新連結或檔名：', r.attachments[idx].url || '');
    if (nextUrl === null) return;
    r.attachments[idx].url = nextUrl.trim();
    saveReportsToStorage(state.reports);
    renderMainView();
  };

  window.removeAttachment = function (reportId, idx) {
    var r = state.reports.find(function (item) { return item.id === reportId; });
    if (!r || !Array.isArray(r.attachments)) return;
    r.attachments.splice(idx, 1);
    saveReportsToStorage(state.reports);
    renderMainView();
  };

  window.openAlbumPage = function (siteName) {
    var q = siteName ? ('?site=' + encodeURIComponent(siteName)) : '';
    window.location.href = 'album.html' + q;
  };

  window.openAlbumFromEditor = function () {
    var site = ((document.getElementById('fieldSite') || {}).value || '').trim();
    window.openAlbumPage(site);
  };

  window.shareRecord = function (id) {
    var url = new URL('view.html?view=public&reportId=' + encodeURIComponent(id), window.location.href).href;
    copyShareLink(url);
  };

  function copyShareLink(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        alert('已複製分享連結：\n' + url);
      }).catch(function () {
        prompt('複製以下分享連結：', url);
      });
    } else {
      prompt('複製以下分享連結：', url);
    }
  }
  window.copyShareLink = copyShareLink;

  window.onFieldSiteInput = function () {};
  window.handlePdfUpload = function () {};
  window.handlePhotoUpload = function () {};

  window.lockSystem = function () {
    try { sessionStorage.removeItem(PASSCODE_KEY); } catch (e) {}
    var gate = document.getElementById('passcodeGate');
    if (gate) gate.classList.remove('hidden');
  };

  window.unlockSystem = function () {
    var input = document.getElementById('passcodeInput');
    if (!DEFAULT_PASSCODE || (input && input.value === DEFAULT_PASSCODE)) {
      try { sessionStorage.setItem(PASSCODE_KEY, '1'); } catch (e) {}
      var gate = document.getElementById('passcodeGate');
      if (gate) gate.classList.add('hidden');
    } else {
      alert('密碼錯誤');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    state.reports = loadReports();
    renderMainView();
  });
})();
