var app = (function () {
  'use strict';

  var API = 'https://api.hevyapp.com/v1';

  // State
  var apiKey = '';
  var allTemplates = [];        // all templates loaded from API
  var wrongTemplateId = null;
  var wrongTemplateTitle = '';
  var rightTemplateId = null;
  var rightTemplateTitle = '';
  var wrongSearch = '';          // current filter query for wrong list
  var rightSearch = '';          // current filter query for right list
  var wrongPage = 1;             // current page for wrong list (1-based)
  var rightPage = 1;            // current page for right list
  var pageSize = 20;            // templates shown per "page" in the UI
  var allAffectedWorkouts = []; // [{workout, exerciseIndices}]
  var isScanning = false;
  var isReplacing = false;

  // DOM helpers
  function $ (id) { return document.getElementById(id); }

  // ─── API ────────────────────────────────────────────────────────────────────

  async function apiFetch (path, opts) {
    opts = opts || {};
    var headers = { 'api-key': apiKey, 'Content-Type': 'application/json' };
    var res = await fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body });
    if (!res.ok) {
      var body = await res.text();
      throw new Error('HTTP ' + res.status + ': ' + body);
    }
    return res.json();
  }

  // Load ALL templates from the API (all pages), then call onDone
  async function loadAllTemplates (onDone) {
    var templates = [];
    var page = 1;
    var pageCount = 1;

    $('wrongTemplateList').innerHTML = '<div class="loader">Loading exercise templates...</div>';

    try {
      while (page <= pageCount) {
        var data = await apiFetch('/exercise_templates?page=' + page + '&pageSize=100');
        templates = templates.concat(data.exercise_templates);
        pageCount = data.page_count || page;
        page++;
      }
      allTemplates = templates;
      onDone();
    } catch (e) {
      $('wrongTemplateList').innerHTML = '<div class="msg error">Failed to load templates: ' + e.message + '</div>';
    }
  }

  // ─── Filter helpers ─────────────────────────────────────────────────────────

  function filterTemplates (query) {
    if (!query) return allTemplates;
    var q = query.toLowerCase();
    return allTemplates.filter(function (t) {
      return t.title.toLowerCase().indexOf(q) !== -1 ||
        (t.primary_muscle_group && t.primary_muscle_group.toLowerCase().indexOf(q) !== -1) ||
        t.id.toLowerCase().indexOf(q) !== -1;
    });
  }

  function slicePage (arr, page) {
    var start = (page - 1) * pageSize;
    return arr.slice(start, start + pageSize);
  }

  // ─── Render template list ────────────────────────────────────────────────────

  var TYPE_COLOR = {
    weight_reps: 'success-tag',
    bodyweight_reps: 'warning',
    reps_only: 'warning',
    bodyweight_assisted_reps: 'warning',
    duration: 'danger-tag',
    weight_duration: 'danger-tag',
    distance_duration: 'danger-tag',
    short_distance_weight: 'danger-tag'
  };

  function templateHtml (t, selectedId, right) {
    var cls = (t.id === selectedId) ? (right ? 'selected-right' : 'selected-wrong') : '';
    var tc = TYPE_COLOR[t.type] || '';
    var customTag = t.is_custom ? '<span class="tag warning">Custom</span>' : '<span class="tag">Built-in</span>';
    return '<div class="exercise-item ' + cls + '" onclick="app.select' + (right ? 'Right' : 'Wrong') + '(\'' + t.id + '\', \'' + t.title.replace(/'/g, "\\'") + '\')">' +
      '<div class="title">' + escHtml(t.title) + ' ' + customTag + '</div>' +
      '<div class="meta">' +
      '<span class="tag ' + tc + '">' + (t.type || '?') + '</span> ' +
      '<span class="tag">' + (t.primary_muscle_group || '?') + '</span> ' +
      '<span class="tag">' + (t.equipment_category || '?') + '</span>' +
      '&nbsp;&nbsp;ID: ' + t.id +
      '</div></div>';
  }

  function renderWrongList () {
    var filtered = filterTemplates(wrongSearch);
    var sliced = slicePage(filtered, wrongPage);
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

    if (sliced.length === 0) {
      $('wrongTemplateList').innerHTML = '<p class="empty">No templates match "' + escHtml(wrongSearch) + '"</p>';
    } else {
      $('wrongTemplateList').innerHTML = sliced.map(function (t) {
        return templateHtml(t, wrongTemplateId, false);
      }).join('');
    }

    renderPagination('wrongPagination', filtered.length, wrongPage, totalPages, function (p) {
      wrongPage = p;
      renderWrongList();
    });
  }

  function renderRightList () {
    var filtered = filterTemplates(rightSearch);
    var sliced = slicePage(filtered, rightPage);
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

    if (sliced.length === 0) {
      $('rightTemplateList').innerHTML = '<p class="empty">No templates match "' + escHtml(rightSearch) + '"</p>';
    } else {
      $('rightTemplateList').innerHTML = sliced.map(function (t) {
        return templateHtml(t, rightTemplateId, true);
      }).join('');
    }

    renderPagination('rightPagination', filtered.length, rightPage, totalPages, function (p) {
      rightPage = p;
      renderRightList();
    });
  }

  // ─── Pagination ──────────────────────────────────────────────────────────────

  function renderPagination (containerId, totalItems, currentPage, pageCount, onPage) {
    var container = $(containerId);
    if (pageCount <= 1) { container.innerHTML = ''; return; }

    var start = Math.max(1, currentPage - 2);
    var end = Math.min(pageCount, currentPage + 2);
    var html = '';

    html += '<button ' + (currentPage <= 1 ? 'disabled' : '') + ' onclick="app.gotoWrongPage(' + (currentPage - 1) + ')">&larr; Prev</button>';
    for (var p = start; p <= end; p++) {
      var cls = (p === currentPage) ? ' class="current-page"' : '';
      html += '<button' + cls + ' onclick="app.gotoWrongPage(' + p + ')">' + p + '</button>';
    }
    html += '<button ' + (currentPage >= pageCount ? 'disabled' : '') + ' onclick="app.gotoWrongPage(' + (currentPage + 1) + ')">Next &rarr;</button>';
    html += '<span class="page-info">' + (currentPage - 1) * pageSize + 1 + '-' + Math.min(currentPage * pageSize, totalItems) + ' of ' + totalItems + '</span>';

    container.innerHTML = html;
  }

  // ─── Connect ────────────────────────────────────────────────────────────────

  function connect () {
    apiKey = $('apiKeyInput').value.trim();
    if (!apiKey) { setStatus('Please enter your API key.', 'error'); return; }
    localStorage.setItem('hevyApiKey', apiKey);

    $('card2').style.display = 'block';
    $('card3').style.display = 'none';
    $('card4').style.display = 'none';
    $('arrow2').style.display = 'none';
    setStatus('', '');

    wrongTemplateId = null;
    wrongTemplateTitle = '';
    rightTemplateId = null;
    rightTemplateTitle = '';
    wrongSearch = '';
    rightSearch = '';
    $('wrongSearch').value = '';
    $('rightSearch').value = '';
    wrongPage = 1;
    rightPage = 1;

    loadAllTemplates(function () {
      renderWrongList();
    });
  }

  // ─── Search handlers ─────────────────────────────────────────────────────────

  function onWrongSearch (value) {
    wrongSearch = value;
    wrongPage = 1;
    renderWrongList();
  }

  function onRightSearch (value) {
    rightSearch = value;
    rightPage = 1;
    renderRightList();
  }

  // ─── Pagination navigation ───────────────────────────────────────────────────

  function gotoWrongPage (page) {
    wrongPage = page;
    renderWrongList();
  }

  function gotoRightPage (page) {
    rightPage = page;
    renderRightList();
  }

  // ─── Select templates ────────────────────────────────────────────────────────

  function selectWrong (id, title) {
    wrongTemplateId = id;
    wrongTemplateTitle = title;
    $('arrow2').style.display = 'block';
    $('card3').style.display = 'block';
    $('card4').style.display = 'none';
    rightTemplateId = null;
    rightTemplateTitle = '';
    rightSearch = '';
    $('rightSearch').value = '';
    rightPage = 1;
    renderWrongList();
    renderRightList();
    setStatus('', '');
    setStatus('Selected: <strong>' + escHtml(title) + '</strong> -- now pick the replacement below.', 'info');
  }

  function selectRight (id, title) {
    rightTemplateId = id;
    rightTemplateTitle = title;
    renderRightList();
    $('card4').style.display = 'block';
    setStatus('', '');
    setStatus('Both templates selected. Scanning your workouts...', 'info');
    scanAllWorkouts();
  }

  // ─── Scan workouts ───────────────────────────────────────────────────────────

  async function scanAllWorkouts () {
    isScanning = true;
    var btn = $('replaceBtn');
    btn.disabled = true;
    btn.textContent = 'Scanning...';
    allAffectedWorkouts = [];
    $('statTotal').textContent = '-';
    $('statAffected').textContent = '-';
    $('statExercises').textContent = '-';
    $('affectedList').innerHTML = '<div class="loader">Scanning workouts...</div>';

    try {
      // Total count
      var countData = await apiFetch('/workouts/count');
      $('statTotal').textContent = countData.workout_count;

      var pageCount = Math.ceil(countData.workout_count / 10);
      var affectedMap = {};
      var totalExercises = 0;

      // Scan all pages
      for (var p = 1; p <= pageCount; p++) {
        var data = await apiFetch('/workouts?page=' + p + '&pageSize=10');
        for (var wi = 0; wi < data.workouts.length; wi++) {
          var wk = data.workouts[wi];
          for (var ei = 0; ei < wk.exercises.length; ei++) {
            var ex = wk.exercises[ei];
            if (ex.exercise_template_id === wrongTemplateId) {
              totalExercises++;
              if (!affectedMap[wk.id]) {
                affectedMap[wk.id] = { workout: wk, exerciseIndices: [] };
              }
              affectedMap[wk.id].exerciseIndices.push(ei);
            }
          }
        }
      }

      allAffectedWorkouts = Object.keys(affectedMap).map(function (k) { return affectedMap[k]; });
      var affectedCount = allAffectedWorkouts.length;

      $('statAffected').textContent = affectedCount;
      $('statExercises').textContent = totalExercises;

      if (allAffectedWorkouts.length === 0) {
        $('affectedList').innerHTML = '<p class="empty">No workouts found with "' + escHtml(wrongTemplateTitle) + '". Nothing to replace.</p>';
        btn.disabled = true;
        btn.textContent = 'No matches found';
        setStatus('No workouts found containing "' + escHtml(wrongTemplateTitle) + '".', 'info');
        return;
      }

      // Render affected list
      $('affectedList').innerHTML = allAffectedWorkouts.map(function (aw) {
        var exTitles = aw.exerciseIndices.map(function (ei) {
          return escHtml(aw.workout.exercises[ei].title);
        }).join(', ');
        return '<div class="log-entry">' +
          '<div class="wk-title">' + escHtml(aw.workout.title) + ' (' + new Date(aw.workout.start_time).toLocaleDateString() + ')</div>' +
          '<div class="wk-detail">' + exTitles + '</div>' +
          '</div>';
      }).join('');

      btn.disabled = false;
      btn.textContent = 'Replace ' + totalExercises + ' Exercise' + (totalExercises !== 1 ? 's' : '') + ' in ' + affectedCount + ' Workout' + (affectedCount !== 1 ? 's' : '');
      setStatus('Found <strong>' + totalExercises + '</strong> exercises to replace in <strong>' + affectedCount + '</strong> workouts.', 'info');

    } catch (e) {
      setStatus('Scan failed: ' + e.message, 'error');
      btn.disabled = true;
      btn.textContent = 'Scan failed';
    }

    isScanning = false;
  }

  // ─── Bulk replace ───────────────────────────────────────────────────────────

  async function doBulkReplace () {
    if (allAffectedWorkouts.length === 0) return;
    if (!confirm('This will update ' + allAffectedWorkouts.length + ' workouts. Are you sure?')) return;

    isReplacing = true;
    var btn = $('replaceBtn');
    btn.disabled = true;
    btn.textContent = 'Replacing...';
    setStatus('Replacing...', 'info');
    $('progressText').textContent = '0 / ' + allAffectedWorkouts.length;
    $('replaceLog').style.display = 'block';
    $('logEntries').innerHTML = '';

    var total = allAffectedWorkouts.length;
    var done = 0;
    var ok = 0;
    var fail = 0;

    for (var i = 0; i < allAffectedWorkouts.length; i++) {
      var aw = allAffectedWorkouts[i];
      var workout = aw.workout;
      var exerciseIndices = aw.exerciseIndices;

      var updatedWorkout = {
        title: workout.title,
        description: workout.description || null,
        start_time: workout.start_time,
        end_time: workout.end_time,
        is_private: !!workout.is_private,
        exercises: workout.exercises.map(function (e, ei) {
          return {
            exercise_template_id: exerciseIndices.indexOf(ei) !== -1 ? rightTemplateId : e.exercise_template_id,
            superset_id: e.supersets_id || null,
            notes: e.notes || null,
            sets: e.sets.map(function (s) {
              return {
                type: s.type || 'normal',
                weight_kg: s.weight_kg,
                reps: s.reps,
                distance_meters: s.distance_meters,
                duration_seconds: s.duration_seconds,
                custom_metric: s.custom_metric,
                rpe: s.rpe
              };
            })
          };
        })
      };

      var statusClass = 'ok';
      var statusText = 'Replaced with ' + escHtml(rightTemplateTitle);

      try {
        await apiFetch('/workouts/' + workout.id, {
          method: 'PUT',
          body: JSON.stringify({ workout: updatedWorkout })
        });
        ok++;
      } catch (e) {
        statusClass = 'fail';
        statusText = 'FAILED: ' + e.message;
        fail++;
      }

      $('logEntries').innerHTML +=
        '<div class="log-entry ' + statusClass + '">' +
        '<div class="wk-title">' + escHtml(workout.title) + '</div>' +
        '<div class="wk-detail">' + statusText + '</div>' +
        '</div>';

      var logEl = $('logEntries');
      logEl.scrollTop = logEl.scrollHeight;

      done++;
      $('progressText').textContent = done + ' / ' + total;
    }

    isReplacing = false;
    if (fail === 0) {
      setStatus('Done! Replaced ' + ok + ' exercises across ' + allAffectedWorkouts.length + ' workouts.', 'success');
    } else {
      setStatus('Done with errors. ' + ok + ' replaced, ' + fail + ' failed.', 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Done';
    btn.className = 'cancel';
    btn.onclick = reset;
  }

  // ─── Reset ─────────────────────────────────────────────────────────────────

  function reset () {
    wrongTemplateId = null;
    wrongTemplateTitle = '';
    rightTemplateId = null;
    rightTemplateTitle = '';
    wrongSearch = '';
    rightSearch = '';
    $('wrongSearch').value = '';
    $('rightSearch').value = '';
    wrongPage = 1;
    rightPage = 1;
    allAffectedWorkouts = [];
    $('card3').style.display = 'none';
    $('card4').style.display = 'none';
    $('arrow2').style.display = 'none';
    $('replaceLog').style.display = 'none';
    $('logEntries').innerHTML = '';
    var btn = $('replaceBtn');
    btn.className = 'success';
    btn.onclick = doBulkReplace;
    setStatus('', '');
    setStatus('Ready. Select the exercise you want to replace.', 'info');
  }

  // ─── Status ─────────────────────────────────────────────────────────────────

  function setStatus (html, type) {
    if (!html) { $('status').innerHTML = ''; return; }
    $('status').innerHTML = '<div class="msg ' + type + '">' + html + '</div>';
  }

  // ─── HTML escape ────────────────────────────────────────────────────────────

  function escHtml (s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Auto-fill saved key ────────────────────────────────────────────────────

  var savedKey = localStorage.getItem('hevyApiKey');
  if (savedKey) $('apiKeyInput').value = savedKey;

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    connect: connect,
    onWrongSearch: onWrongSearch,
    onRightSearch: onRightSearch,
    gotoWrongPage: gotoWrongPage,
    gotoRightPage: gotoRightPage,
    selectWrong: selectWrong,
    selectRight: selectRight,
    doBulkReplace: doBulkReplace,
    reset: reset
  };

})();