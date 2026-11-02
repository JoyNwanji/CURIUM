const loader = document.querySelector('#loader');
const onboarding = document.querySelector('#onboarding');
const dashboard = document.querySelector('#dashboard');
const loadFill = document.querySelector('.load-track span');
const loadNumber = document.querySelector('#load-number');
const formArea = document.querySelector('#form-area');
const steps = [...document.querySelectorAll('.step')];
const toast = document.querySelector('#toast');

let currentStep = 0;
const savedLearnerProfile = readSaved('curiumProfile', {});
let selectedEducation = savedLearnerProfile.education || 'Secondary school';
let selectedFirstStep = 'Start researching';
let learnerName = savedLearnerProfile.name || '';
let learnerEmail = savedLearnerProfile.email || '';
let universityDetails = { course: savedLearnerProfile.course || '', level: savedLearnerProfile.level || '', department: savedLearnerProfile.department || '', institution: savedLearnerProfile.institution || '' };
let toastTimer;
let activeStudyStart = 0;
let studyTimer;
let editingAssignment = null;

function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function saveValue(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { showToast('This browser could not save the change. Try opening Curium in a browser tab.'); }
}

function openUploadStore() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Local file storage is unavailable.'));
    const request = indexedDB.open('curium-local-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('uploads', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeUpload(file, kind) {
  const db = await openUploadStore();
  const upload = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, kind, type: file.type, blob: file, addedAt: Date.now() };
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('uploads', 'readwrite');
    transaction.objectStore('uploads').put(upload);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  return upload;
}

async function readUploads() {
  const db = await openUploadStore();
  return new Promise((resolve, reject) => {
    const request = db.transaction('uploads', 'readonly').objectStore('uploads').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.addedAt - a.addedAt));
    request.onerror = () => reject(request.error);
  });
}

// A small animated welcome screen, then the three simple setup steps.
let progress = 0;
const loading = setInterval(() => {
  progress = Math.min(100, progress + 2);
  loadFill.style.width = `${progress}%`;
  loadNumber.textContent = `${progress}%`;
  if (progress === 100) {
    clearInterval(loading);
    setTimeout(() => {
      loader.classList.add('exit');
      const profile = readSaved('curiumProfile', {});
      const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || '');
      if (profile.name?.trim() && hasValidEmail && profile.education) {
        selectedEducation = profile.education;
        learnerName = profile.name;
        learnerEmail = profile.email;
        universityDetails = { course: profile.course || '', level: profile.level || '', department: profile.department || '', institution: profile.institution || '' };
        openDashboard();
      } else {
        onboarding.classList.remove('hidden');
        renderStep();
      }
    }, 350);
  }
}, 32);

function renderStep() {
  steps.forEach((step, index) => {
    step.classList.toggle('active', index === currentStep);
    step.classList.toggle('done', index < currentStep);
    step.querySelector('i').textContent = index < currentStep ? '✓' : index + 1;
  });

  if (currentStep === 0) {
    formArea.innerHTML = `
      <span class="eyebrow">01 / YOUR DETAILS</span>
      <h1>Make room to learn.</h1>
      <p class="form-subtitle">Tell us a little about yourself. We’ll make your learning space feel like yours.</p>
      <label class="field">Your name<input id="name-field" placeholder="What should we call you?" autocomplete="name" required></label>
      <label class="field">Email address<input id="email-field" type="email" placeholder="you@example.com" autocomplete="email" required></label>
      <label class="field">Username <small>(optional)</small><input placeholder="Choose a username"></label>
      <div class="form-actions"><span></span><button class="primary-button" id="next-step">Continue →</button></div>`;
    document.querySelector('#name-field').value = learnerName;
    document.querySelector('#email-field').value = learnerEmail;
    document.querySelector('#next-step').addEventListener('click', () => {
      const nameField = document.querySelector('#name-field');
      const emailField = document.querySelector('#email-field');
      nameField.setCustomValidity(nameField.value.trim() ? '' : 'Please enter your name.');
      emailField.setCustomValidity(emailField.value.trim() ? '' : 'Please enter a valid email address.');
      if (!nameField.reportValidity() || !emailField.reportValidity()) return;
      learnerName = nameField.value.trim();
      learnerEmail = emailField.value.trim();
      saveValue('curiumProfile', { ...readSaved('curiumProfile', {}), name: learnerName, email: learnerEmail });
      currentStep = 1;
      renderStep();
    });
  }

  if (currentStep === 1) {
    formArea.innerHTML = `
      <span class="eyebrow">02 / YOUR EDUCATION</span>
      <h1>Where are you learning, ${learnerName}?</h1>
      <p class="form-subtitle">Choose your education level so we can guide you with the right context. You can change this later.</p>
      <div class="education-grid">
        <button class="education-card ${selectedEducation === 'Secondary school' ? 'active' : ''}" data-education="Secondary school"><span class="card-icon">▤</span><h3>Secondary school</h3><p>Build strong foundations in your subjects, from junior to senior secondary school.</p><small>Nigerian curriculum · WAEC / NECO</small></button>
        <button class="education-card ${selectedEducation === 'University' ? 'active' : ''}" data-education="University"><span class="card-icon">⌂</span><h3>University</h3><p>Go deeper into your courses with support shaped around your degree and institution.</p><small>Institution-specific course outlines</small></button>
      </div>
      ${selectedEducation === 'University' ? `
        <div class="university-fields">
          <p class="field-heading">Personalize your university space</p>
          <label class="field">Course<input id="course-field" placeholder="e.g. Computer Science" required></label>
          <label class="field">Level<input id="level-field" placeholder="e.g. 200 level" required></label>
          <label class="field">Department<input id="department-field" placeholder="e.g. Computer Science" required></label>
          <label class="field">University <small>(optional)</small><input id="institution-field" placeholder="e.g. University of Lagos"></label>
        </div>` : ''}
      <div class="form-actions"><button class="secondary-button" id="previous-step">← Back</button><button class="primary-button" id="next-step">Continue →</button></div>`;
    document.querySelectorAll('[data-education]').forEach(card => card.addEventListener('click', () => {
      selectedEducation = card.dataset.education;
      renderStep();
    }));
    document.querySelector('#previous-step').addEventListener('click', () => { currentStep = 0; renderStep(); });
    document.querySelector('#next-step').addEventListener('click', () => {
      if (selectedEducation === 'University') {
        const requiredFields = ['course-field', 'level-field', 'department-field'].map(id => document.querySelector(`#${id}`));
        if (!requiredFields.every(field => field.reportValidity())) return;
      }
      currentStep = 2;
      renderStep();
    });
    if (selectedEducation === 'University') {
      ['course', 'level', 'department', 'institution'].forEach(key => {
        document.querySelector(`#${key}-field`).value = universityDetails[key];
      });
      ['course', 'level', 'department', 'institution'].forEach(key => {
        document.querySelector(`#${key}-field`).addEventListener('input', event => { universityDetails[key] = event.target.value.trim(); });
      });
    }
  }

  if (currentStep === 2) {
    const options = [
      ['Start researching', 'Explore a question and find reliable sources.'],
      ['Work on an assignment', 'Break a big question into smaller steps.'],
      ['Explain my notes', 'Turn class notes into clear explanations.'],
      [selectedEducation === 'University' ? 'Upload study materials' : 'Attach a curriculum', selectedEducation === 'University' ? 'Add a lecture, timetable or course outline.' : 'Add your school scheme of work.']
    ];
    formArea.innerHTML = `
      <span class="eyebrow">03 / YOUR FIRST STEP</span>
      <h1>What would you like to do?</h1>
      <p class="form-subtitle">Follow a question, untangle an idea or bring your learning materials. This is your space.</p>
      <div class="first-step-grid">${options.map(([title, detail]) => `<button class="${title === selectedFirstStep ? 'active' : ''}" data-first-step="${title}"><strong>${title}</strong><small>${detail}</small></button>`).join('')}</div>
      <div class="form-actions"><button class="secondary-button" id="previous-step">← Back</button><button class="primary-button" id="finish-setup">Explore my learning space →</button></div>`;
    document.querySelectorAll('[data-first-step]').forEach(card => card.addEventListener('click', () => {
      selectedFirstStep = card.dataset.firstStep;
      renderStep();
    }));
    document.querySelector('#previous-step').addEventListener('click', () => { currentStep = 1; renderStep(); });
    document.querySelector('#finish-setup').addEventListener('click', openDashboard);
  }
}

function openDashboard() {
  onboarding.classList.add('hidden');
  dashboard.classList.remove('hidden');
  document.querySelector('#greeting').textContent = `A good day to get a little further, ${learnerName}.`;
  document.querySelector('#avatar').textContent = learnerName.charAt(0).toUpperCase();
  document.querySelector('#space-level').textContent = selectedEducation;
  const learnerProfile = {
    ...readSaved('curiumProfile', {}),
    country: 'NG',
    name: learnerName,
    email: learnerEmail,
    education: selectedEducation,
    level: selectedEducation === 'University' ? universityDetails.level || 'University level' : readSaved('curiumProfile', {}).level || 'SS 2',
    course: universityDetails.course,
    department: universityDetails.department,
    institution: universityDetails.institution,
    subject: readSaved('curiumProfile', {}).subject || 'Science',
    exams: readSaved('curiumProfile', {}).exams || []
  };
  saveValue('curiumProfile', learnerProfile);
  if (selectedEducation === 'University') {
    const course = universityDetails.course || 'Your course';
    const level = universityDetails.level || 'University level';
    document.querySelector('#space-subject').textContent = `${level} · ${course}`;
    document.querySelector('#intro').textContent = `Your ${course} learning space, set up around your courses and materials.`;
    document.querySelector('#quick-curriculum-title').textContent = 'Upload course materials';
    document.querySelector('#quick-curriculum-copy').textContent = 'Add lecture notes, your timetable or a course outline.';
    document.querySelector('#quick-curriculum').dataset.action = 'Upload study materials';
    document.querySelector('#continue-eyebrow').textContent = `${course.toUpperCase()} · YOUR COURSE SPACE`;
    document.querySelector('#continue-title').textContent = 'Your course starts here';
    document.querySelector('#continue-progress').textContent = 'Add your first lecture or course material to get started';
    document.querySelector('#continue-button').textContent = 'Add course material →';
    document.querySelector('#assignment-heading').textContent = 'Your courses';
    document.querySelector('#assignment-summary').firstChild.textContent = `${universityDetails.department || course}${universityDetails.institution ? ` · ${universityDetails.institution}` : ''}`;
    document.querySelectorAll('.assignment-row').forEach((row, index) => {
      row.querySelector('.assignment-name strong').textContent = ['Course overview', 'Lecture notes', 'Study plan'][index];
      row.querySelector('.assignment-name small').textContent = `${course} · Add your own course content`;
      row.querySelector('.due small').textContent = 'Ready when you are';
      row.querySelector('.due b').textContent = 'Get started';
    });
    document.querySelector('#recent-heading').textContent = 'Recently added materials';
    const recentCards = document.querySelectorAll('.recent-card');
    recentCards[0].querySelector('strong').textContent = 'Lecture materials';
    recentCards[0].querySelector('small').textContent = `Add lectures for ${course} · Waiting for your first upload`;
    recentCards[1].querySelector('strong').textContent = 'University timetable';
    recentCards[1].querySelector('small').textContent = 'Your weekly class schedule · Waiting for your first upload';
    document.querySelector('#path-title').textContent = course;
    document.querySelector('#path-description').textContent = `${universityDetails.department || course}${universityDetails.institution ? ` · ${universityDetails.institution}` : ''} · ${level}`;
    document.querySelector('#curriculum-label').textContent = 'Course outline';
    document.querySelector('#curriculum-file strong').textContent = 'Add a course outline';
    document.querySelector('#curriculum-file small').textContent = 'Upload your course outline or syllabus';
    document.querySelector('#subject-count-text').textContent = 'Your courses and study materials';
    document.querySelector('#curriculum-tip').textContent = 'Keep your lectures, timetable and course outline together in your university learning space.';
    document.querySelector('#upload-curriculum').textContent = '＋ Add course outline';
    document.querySelector('#study-heading').textContent = 'Your study week';
    document.querySelector('#idea-title').textContent = 'Make your course your own';
    document.querySelector('#idea-copy').textContent = 'Add a lecture or timetable to shape this space around your studies.';
    document.querySelector('.material-buttons').hidden = false;
  } else {
    document.querySelector('#space-subject').textContent = `${learnerProfile.level} · ${learnerProfile.subject}`;
    document.querySelector('#path-title').textContent = `${learnerProfile.level} · First term`;
    document.querySelector('#space-level').textContent = learnerProfile.education;
    document.querySelector('#intro').textContent = 'Pick up where you left off, or follow a new question.';
  }
  const today = new Date();
  document.querySelector('#today').textContent = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  renderStudyTracker();
  renderSavedAssignments();
  restoreUploadedFiles();
  if (selectedFirstStep === 'Attach a curriculum') document.querySelector('#curriculum-input').click();
  if (selectedFirstStep === 'Upload study materials') document.querySelector('#lecture-input').click();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// Button flows, uploads, assignment actions, and the study tracker are wired below.

function openResearch(topic = '') {
  document.querySelector('#research-query').value = topic;
  document.querySelector('#research-dialog').showModal();
  setTimeout(() => document.querySelector('#research-query').focus(), 50);
}

function openResults(query, goal = 'overview') {
  const profile = readSaved('curiumProfile', {});
  const params = new URLSearchParams({ q: query, goal });
  if (profile.course) params.set('subject', profile.course);
  (Array.isArray(profile.exams) ? profile.exams : []).forEach(exam => params.append('exam', exam));
  const path = `results.html?${params.toString()}`;
  if (!window.open(path, '_blank')) location.href = path;
}

function openAssignment(row = null) {
  editingAssignment = row;
  document.querySelector('#assignment-form').reset();
  document.querySelector('#assignment-dialog-title').textContent = row ? 'Update your assignment' : 'Add an assignment';
  document.querySelector('#assignment-save').textContent = row ? 'Save changes →' : 'Add assignment →';
  document.querySelector('#assignment-input').value = row ? row.querySelector('.assignment-name strong').textContent : '';
  document.querySelector('#assignment-subject').value = row ? row.querySelector('.assignment-name small').textContent.split(' · ')[0] : '';
  document.querySelector('#assignment-status').value = row ? row.querySelector('.due b').textContent : 'Not started';
  document.querySelector('#assignment-dialog').showModal();
}

function makeAssignmentRow(title, subject, status = 'Not started') {
  const row = document.createElement('button');
  row.className = 'assignment-row';
  row.dataset.action = title;
  row.innerHTML = '<span class="mini-icon">▤</span><span class="assignment-name"><strong></strong><small></small></span><span class="due"><small>Added to your plan</small><b></b></span><span class="row-arrow">›</span>';
  row.querySelector('.assignment-name strong').textContent = title;
  row.querySelector('.assignment-name small').textContent = subject;
  row.querySelector('.due b').textContent = status;
  return row;
}

function renderSavedAssignments() {
  const list = document.querySelector('#assignment-list');
  const overrides = readSaved('curiumAssignmentOverrides', {});
  [...list.querySelectorAll('.assignment-row')].forEach((row, index) => {
    if (row.dataset.savedAssignment) return;
    const key = `demo-${index}`;
    row.dataset.demoAssignment = key;
    const item = overrides[key];
    if (item) {
      row.querySelector('.assignment-name strong').textContent = item.title;
      row.querySelector('.assignment-name small').textContent = item.subject;
      row.querySelector('.due b').textContent = item.status;
      row.dataset.action = item.title;
    }
  });
  readSaved('curiumAssignments', []).forEach(item => {
    if (list.querySelector(`[data-saved-assignment="${CSS.escape(item.id)}"]`)) return;
    const row = makeAssignmentRow(item.title, item.subject, item.status);
    row.dataset.savedAssignment = item.id;
    list.append(row);
  });
  const incomplete = [...list.querySelectorAll('.assignment-row')].filter(row => row.querySelector('.due b').textContent !== 'Completed').length;
  document.querySelector('.nav-item[data-view="Assignments"] b').textContent = incomplete;
}

function openSavedResources() {
  renderSavedResources();
}

function renderSavedResources() {
  const dialog = document.querySelector('#saved-dialog');
  const items = readSaved('curiumSavedResources', []);
  const container = document.querySelector('#saved-items');
  container.replaceChildren();
  document.querySelector('#saved-empty').hidden = items.length > 0;
  items.forEach((item, index) => {
    const line = document.createElement('div');
    line.className = 'saved-item';
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = item.title;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      const updated = readSaved('curiumSavedResources', []);
      updated.splice(index, 1);
      saveValue('curiumSavedResources', updated);
      renderSavedResources();
    });
    line.append(link, remove);
    container.append(line);
  });
  if (!dialog.open) dialog.showModal();
}

function openProfile() {
  const profile = readSaved('curiumProfile', {});
  const university = profile.education === 'University';
  document.querySelector('#profile-university-fields').hidden = !university;
  document.querySelector('#profile-secondary-fields').hidden = university;
  document.querySelector('#profile-course').value = profile.course || '';
  document.querySelector('#profile-level').value = profile.level || '';
  document.querySelector('#profile-department').value = profile.department || '';
  document.querySelector('#profile-institution').value = profile.institution || '';
  document.querySelector('#profile-class').value = profile.level || 'SS 2';
  document.querySelector('#profile-subject').value = profile.subject || '';
  document.querySelector('#profile-dialog').showModal();
}

function navigateTo(view) {
  document.querySelector('#crumb').textContent = view;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('selected', item.dataset.view === view));
  if (view === 'Research') return openResearch();
  if (view === 'My notes') return document.querySelector('#notes-input').click();
  if (view === 'Saved resources') return openSavedResources();
  const target = {
    Overview: '.dashboard-content',
    Assignments: '#assignments-section',
    'My curriculum': '#curriculum-section',
    'My subjects': '#courses-section',
    History: '#resources-section'
  }[view];
  if (target) document.querySelector(target).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => navigateTo(button.dataset.view)));
document.querySelector('#search-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.value.trim()) openResults(event.target.value.trim());
});
document.querySelector('#research-form').addEventListener('submit', event => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return document.querySelector('#research-dialog').close();
  const query = document.querySelector('#research-query').value.trim();
  const goal = document.querySelector('#research-goal').value;
  document.querySelector('#research-dialog').close();
  if (query) openResults(query, goal);
});

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close-dialog]');
  if (close) document.querySelector(`#${close.dataset.closeDialog}`).close();
  const view = event.target.closest('[data-view]:not(.nav-item)');
  if (view) return navigateTo(view.dataset.view);
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const name = action.dataset.action;
  if (name === 'Start researching') return openResearch();
  if (name === 'Work on an assignment' || name === 'Add an assignment') return openAssignment();
  if (name === 'Explain my notes') return document.querySelector('#notes-input').click();
  if (name === 'Attach a curriculum') {
    document.querySelector('#curriculum-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return document.querySelector('#curriculum-input').click();
  }
  if (name === 'Manage curriculum') {
    document.querySelector('#curriculum-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return document.querySelector('#curriculum-input').click();
  }
  if (name === 'Upload study materials') return document.querySelector('#lecture-input').click();
  if (name === 'Continue learning') {
    const profile = readSaved('curiumProfile', {});
    if (profile.education === 'University') return document.querySelector('#lecture-input').click();
    return openResults('photosynthesis in plants', 'coursework');
  }
  const row = action.closest('.assignment-row');
  if (row) return openAssignment(row);
  if (action.closest('.recent-card')) return openResearch(name);
  showToast(`${name} is ready in your learning space.`);
});

document.querySelector('.space-picker').addEventListener('click', openProfile);
document.querySelector('#avatar').addEventListener('click', openProfile);
document.querySelector('#profile-form').addEventListener('submit', event => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return document.querySelector('#profile-dialog').close();
  const profile = readSaved('curiumProfile', {});
  if (profile.education === 'University') {
    profile.course = document.querySelector('#profile-course').value.trim();
    profile.level = document.querySelector('#profile-level').value.trim();
    profile.department = document.querySelector('#profile-department').value.trim();
    profile.institution = document.querySelector('#profile-institution').value.trim();
    universityDetails = { course: profile.course, level: profile.level, department: profile.department, institution: profile.institution };
    document.querySelector('#space-subject').textContent = `${profile.level || 'University level'} · ${profile.course || 'Your course'}`;
    document.querySelector('#path-title').textContent = profile.course || 'Your course';
  } else {
    profile.level = document.querySelector('#profile-class').value;
    profile.subject = document.querySelector('#profile-subject').value.trim();
    document.querySelector('#space-subject').textContent = `${profile.level} · ${profile.subject || 'Your subjects'}`;
    document.querySelector('#path-title').textContent = `${profile.level} · First term`;
  }
  saveValue('curiumProfile', profile);
  if (profile.name) {
    learnerName = profile.name;
    document.querySelector('#greeting').textContent = `A good day to get a little further, ${learnerName}.`;
    document.querySelector('#avatar').textContent = learnerName.charAt(0).toUpperCase();
  }
  if (profile.education === 'University') {
    document.querySelector('#space-level').textContent = 'University';
    document.querySelector('#intro').textContent = `Your ${profile.course || 'course'} learning space, set up around your courses and materials.`;
    document.querySelector('#continue-eyebrow').textContent = `${(profile.course || 'YOUR COURSE').toUpperCase()} · YOUR COURSE SPACE`;
    document.querySelector('#continue-title').textContent = 'Your course starts here';
    document.querySelector('#assignment-heading').textContent = 'Your courses';
    document.querySelector('#path-description').textContent = `${profile.department || profile.course || 'Your course'}${profile.institution ? ` · ${profile.institution}` : ''} · ${profile.level || 'University level'}`;
  } else {
    document.querySelector('#space-level').textContent = 'Secondary school';
    document.querySelector('#space-subject').textContent = `${profile.level || 'SS 2'} · ${profile.subject || 'Your subjects'}`;
  }
  document.querySelector('#profile-dialog').close();
  showToast('Your learning space details are updated.');
});

document.querySelector('#assignment-form').addEventListener('submit', event => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') {
    document.querySelector('#assignment-dialog').close();
    editingAssignment = null;
    return;
  }
  const title = document.querySelector('#assignment-input').value.trim();
  const subject = document.querySelector('#assignment-subject').value.trim();
  const status = document.querySelector('#assignment-status').value;
  if (editingAssignment) {
    editingAssignment.querySelector('.assignment-name strong').textContent = title;
    editingAssignment.querySelector('.assignment-name small').textContent = subject;
    editingAssignment.querySelector('.due b').textContent = status;
    editingAssignment.dataset.action = title;
    const saved = readSaved('curiumAssignments', []);
    const item = saved.find(entry => entry.id === editingAssignment.dataset.savedAssignment);
    if (item) Object.assign(item, { title, subject, status });
    saveValue('curiumAssignments', saved);
    if (editingAssignment.dataset.demoAssignment) {
      const overrides = readSaved('curiumAssignmentOverrides', {});
      overrides[editingAssignment.dataset.demoAssignment] = { title, subject, status };
      saveValue('curiumAssignmentOverrides', overrides);
    }
  } else {
    const saved = readSaved('curiumAssignments', []);
    const item = { id: `assignment-${Date.now()}`, title, subject, status };
    saved.push(item);
    saveValue('curiumAssignments', saved);
    const row = makeAssignmentRow(title, subject, status);
    row.dataset.savedAssignment = item.id;
    document.querySelector('#assignment-list').append(row);
  }
  const incomplete = [...document.querySelectorAll('#assignment-list .assignment-row')].filter(row => row.querySelector('.due b').textContent !== 'Completed').length;
  document.querySelector('.nav-item[data-view="Assignments"] b').textContent = incomplete;
  document.querySelector('#assignment-dialog').close();
  editingAssignment = null;
  showToast('Assignment saved to your learning space.');
});

function recentFileCard(file, kind, url = URL.createObjectURL(file.blob || file)) {
  const card = document.createElement('button');
  card.className = 'recent-card recent-upload';
  card.type = 'button';
  const icon = document.createElement('span');
  icon.className = 'mini-icon';
  icon.textContent = kind === 'timetable' ? '◷' : kind === 'lecture' ? '▤' : '＋';
  const content = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = file.name;
  const detail = document.createElement('small');
  detail.textContent = `${kind === 'outline' ? 'Course outline' : kind[0].toUpperCase() + kind.slice(1)} · Added just now`;
  content.append(title, detail);
  card.append(icon, content);
  card.addEventListener('click', () => window.open(url, '_blank'));
  document.querySelector('#resources-section').prepend(card);
}

async function addUploadedFile(file, kind) {
  try {
    const savedFile = await storeUpload(file, kind);
    recentFileCard(savedFile, kind, URL.createObjectURL(savedFile.blob));
    return true;
  } catch {
    recentFileCard(file, kind);
    return false;
  }
}

async function restoreUploadedFiles() {
  try {
    const files = await readUploads();
    files.forEach(file => recentFileCard(file, file.kind, URL.createObjectURL(file.blob)));
  } catch {
    // The rest of the learning space still works if this browser blocks local file storage.
  }
}

document.querySelector('#upload-curriculum').addEventListener('click', () => document.querySelector('#curriculum-input').click());
document.querySelector('#curriculum-file').addEventListener('click', () => document.querySelector('#curriculum-input').click());
document.querySelectorAll('[data-upload-kind]').forEach(button => button.addEventListener('click', () => document.querySelector(`#${button.dataset.uploadKind}-input`).click()));
document.querySelector('#notes-input').addEventListener('change', async event => {
  const results = await Promise.all([...event.target.files].map(file => addUploadedFile(file, 'notes')));
  if (results.length) showToast(results.every(Boolean) ? `${results.length} note file${results.length === 1 ? '' : 's'} saved on this device.` : 'Notes added for this session; this browser could not save all files.');
  event.target.value = '';
});
document.querySelectorAll('.material-input:not(#notes-input)').forEach(input => input.addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const kind = input.dataset.material;
  if (kind === 'outline') {
    document.querySelector('#curriculum-file strong').textContent = file.name;
    document.querySelector('#curriculum-file small').textContent = 'Attached just now';
  } else {
    const chip = document.querySelector(`[data-upload-kind="${kind}"]`);
    chip.textContent = `✓ ${file.name}`;
    chip.title = file.name;
  }
  const persisted = await addUploadedFile(file, kind);
  showToast(persisted ? `${file.name} saved on this device.` : `${file.name} added for this session only.`);
  event.target.value = '';
}));

function weekStart(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderStudyTracker() {
  const sessions = readSaved('curiumStudySessions', []);
  const start = weekStart(new Date());
  const minutesByDay = Array(7).fill(0);
  sessions.forEach(session => {
    const date = new Date(`${session.date}T12:00:00`);
    const index = Math.round((date - start) / 86400000);
    if (index >= 0 && index < 7) minutesByDay[index] += session.seconds / 60;
  });
  const total = minutesByDay.reduce((sum, value) => sum + value, 0);
  document.querySelector('#weekly-hours').textContent = (total / 60).toFixed(1);
  const labels = document.querySelectorAll('.week-days span');
  const bars = document.querySelectorAll('#week-bars i');
  const dayCount = minutesByDay.filter(value => value > 0).length;
  minutesByDay.forEach((minutes, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    labels[index].textContent = date.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
    labels[index].title = date.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' });
    bars[index].style.height = `${minutes ? Math.max(10, Math.min(100, minutes / 60 * 100)) : 5}%`;
    bars[index].title = `${Math.round(minutes)} minutes`;
    bars[index].classList.toggle('today-bar', localDateKey(date) === localDateKey(new Date()));
  });
  document.querySelector('#tracker-message').textContent = total
    ? `You studied on ${dayCount} day${dayCount === 1 ? '' : 's'} this week · ${Math.round(total)} minutes total.`
    : 'Start a study session to begin tracking your time.';
}

function startStudySession() {
  if (activeStudyStart) {
    const elapsed = Math.max(1, Math.floor((Date.now() - activeStudyStart) / 1000));
    const sessions = readSaved('curiumStudySessions', []);
    sessions.push({ date: localDateKey(new Date(activeStudyStart)), seconds: elapsed });
    saveValue('curiumStudySessions', sessions);
    activeStudyStart = 0;
    clearInterval(studyTimer);
    document.querySelector('#start-study').textContent = '▶';
    document.querySelector('#start-study-button').textContent = 'Start a study session';
    renderStudyTracker();
    showToast(`Study session saved: ${Math.max(1, Math.round(elapsed / 60))} minute${elapsed < 90 ? '' : 's'}.`);
    return;
  }
  activeStudyStart = Date.now();
  document.querySelector('#start-study').textContent = '■';
  document.querySelector('#start-study-button').textContent = 'Finish this session';
  const updateTimer = () => {
    const seconds = Math.floor((Date.now() - activeStudyStart) / 1000);
    document.querySelector('#tracker-message').textContent = `Studying now · ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  updateTimer();
  studyTimer = setInterval(updateTimer, 1000);
}

document.querySelector('#start-study').addEventListener('click', startStudySession);
document.querySelector('#start-study-button').addEventListener('click', startStudySession);
