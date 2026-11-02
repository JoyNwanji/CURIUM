const queryField = document.querySelector('#results-query');
const subjectField = document.querySelector('#results-subject');
const resultsForm = document.querySelector('#results-search');
const resultList = document.querySelector('#result-list');
const researchList = document.querySelector('#research-list');
const researchMore = document.querySelector('#research-more');
const showPapers = document.querySelector('#show-papers');
const answerThread = document.querySelector('#answer-thread');
const followupForm = document.querySelector('#followup-form');
const followupInput = document.querySelector('#followup-input');
const moreResults = document.querySelector('#more-results');
const goFurther = document.querySelector('#go-further');
const modeAI = document.querySelector('#mode-ai');
const modeCurriculum = document.querySelector('#mode-curriculum');
let searchMode = 'ai';
let conversation = [];
const params = new URLSearchParams(location.search);
function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function saveValue(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { document.querySelector('#result-message').textContent = 'This browser could not save locally. You can still open any result.'; }
}

const savedProfile = readSaved('curiumProfile', {});
const currentSearch = {
  query: params.get('q') || '',
  goal: params.get('goal') || 'overview',
  exams: params.getAll('exam')
};

queryField.value = currentSearch.query;
subjectField.value = params.get('subject') || savedProfile.course || savedProfile.department || '';
document.querySelector('#results-goal').value = currentSearch.goal;
document.querySelector('#results-context').textContent = savedProfile.education === 'University'
  ? `${savedProfile.level || 'UNIVERSITY'} · ${savedProfile.course || 'YOUR COURSE'}`.toUpperCase()
  : `${savedProfile.level || 'NIGERIAN CURRICULUM'} · ${savedProfile.education || 'SECONDARY SCHOOL'}`.toUpperCase();
if (savedProfile.education === 'University') document.querySelector('#exam-options').hidden = true;

function makeResultCard(resource, index) {
  const card = document.createElement('article');
  card.className = 'result-card';

  const source = document.createElement('span');
  source.className = 'result-source';
  source.textContent = resource.kind;

  const title = document.createElement('h3');
  title.textContent = resource.title;

  const description = document.createElement('p');
  description.textContent = resource.description || 'Open this source to explore the material.';

  const footer = document.createElement('div');
  footer.className = 'result-card-footer';
  const provider = document.createElement('span');
  provider.textContent = resource.source;

  const actions = document.createElement('div');
  actions.className = 'result-actions';
  const save = document.createElement('button');
  save.className = 'save-result';
  save.type = 'button';
  save.textContent = 'Save';
  save.addEventListener('click', () => {
    const saved = readSaved('curiumSavedResources', []);
    if (!saved.some(item => item.url === resource.url)) {
      saved.push({ title: resource.title, source: resource.source, url: resource.url, description: resource.description });
      saveValue('curiumSavedResources', saved);
    }
    save.textContent = 'Saved ✓';
    save.disabled = true;
  });

  const open = document.createElement('a');
  open.className = 'open-result';
  open.href = resource.url;
  open.target = '_blank';
  open.rel = 'noopener';
  open.textContent = 'Open source ↗';

  actions.append(save, open);
  footer.append(provider, actions);
  card.append(source, title, description, footer);
  card.style.animationDelay = `${Math.min(index, 8) * 45}ms`;
  return card;
}

function makeAnswer(resource, question, shortVersion = false) {
  const answer = document.createElement('article');
  answer.className = 'answer-turn';
  const prompt = document.createElement('span');
  prompt.className = 'answer-question';
  prompt.textContent = question;
  const title = document.createElement('h3');
  title.textContent = resource.title;
  const text = document.createElement('p');
  const fullText = resource.description || 'Open the source below to read more about this topic.';
  text.textContent = shortVersion ? `${fullText.split(/(?<=[.!?])\s/).slice(0, 2).join(' ')}` : fullText;
  const source = document.createElement('div');
  source.className = 'answer-source';
  source.append('Source: ');
  const link = document.createElement('a');
  link.href = resource.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = resource.source === 'Wikipedia' ? `${resource.title} on Wikipedia` : resource.source;
  source.append(link);
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'save-answer';
  save.textContent = 'Save this answer';
  save.addEventListener('click', () => {
    const saved = readSaved('curiumSavedResources', []);
    if (!saved.some(item => item.url === resource.url)) {
      saved.push({ title: resource.title, source: resource.source, url: resource.url, description: fullText });
      saveValue('curiumSavedResources', saved);
    }
    save.textContent = 'Saved ✓';
    save.disabled = true;
  });
  const footer = document.createElement('div');
  footer.className = 'answer-footer';
  footer.append(source, save);
  answer.append(prompt, title, text, footer);
  return answer;
}

async function loadResults() {
  const query = queryField.value.trim();
  if (!query) return;
  resultList.replaceChildren();
  answerThread.replaceChildren();
  moreResults.hidden = true;
  goFurther.hidden = false;
  goFurther.disabled = false;
  goFurther.textContent = 'Go further · show related sources and papers';
  researchList.replaceChildren();
  researchMore.hidden = true;
  showPapers.hidden = false;
  showPapers.disabled = false;
  showPapers.textContent = 'I need academic papers';
  showPapers.dataset.loaded = 'false';
  document.querySelector('#result-message').textContent = '';
  document.querySelector('#result-count').textContent = 'Searching trusted sources…';
  conversation = [];
  document.querySelector('#answer-eyebrow').textContent = searchMode === 'ai' ? 'ASK AI · AUTOMATIC PROVIDER FALLBACK' : 'NIGERIAN CURRICULUM';
  document.querySelector('.follow-up-prompts').hidden = searchMode !== 'ai';
  followupForm.hidden = searchMode !== 'ai';
  goFurther.hidden = searchMode !== 'ai';
  document.querySelector('.curriculum-details').hidden = searchMode === 'curriculum';

  const profile = {
    country: 'NG',
    educationLevel: savedProfile.education,
    classLevel: savedProfile.level,
    course: subjectField.value.trim() || savedProfile.course,
    department: savedProfile.department,
    exam: currentSearch.exams.length === 1 ? currentSearch.exams[0] : '',
    exams: currentSearch.exams,
    includeAdmissions: currentSearch.goal === 'exam'
  };

  try {
    const resources = await window.CuriumResources.search(query, profile);
    const uniqueResources = [...new Map(resources.map(item => [item.url, item])).values()];
    const official = uniqueResources.filter(item => /official|curriculum|syllabus|exam learning/i.test(`${item.kind} ${item.source}`));
    const guides = uniqueResources.filter(item => !official.includes(item));
    if (searchMode === 'curriculum') {
      answerThread.replaceChildren();
      if (official.length) answerThread.replaceChildren(...official.map((resource, index) => makeResultCard(resource, index)));
      document.querySelector('#result-count').textContent = official.length ? 'Official Nigerian curriculum and exam sources' : 'No matching curriculum source found';
    } else {
      try {
        const response = await fetch('/api/research', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: query, profile: { education: savedProfile.education, level: savedProfile.level, course: profile.course, department: savedProfile.department }, sources: uniqueResources.map(({ title, source, description, url }) => ({ title, source, description, url })) })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'AI services are unavailable.');
        conversation.push({ role: 'user', content: query }, { role: 'assistant', content: data.answer });
        answerThread.append(makeAIAnswer(data.answer, query, data.provider, data.sources || []));
        document.querySelector('#result-count').textContent = 'A sourced answer, with follow-up questions';
      } catch (error) {
        document.querySelector('#result-count').textContent = 'AI answer unavailable';
        document.querySelector('#result-message').textContent = `${error.message} You can switch to Search Nigerian curriculum or try again later.`;
      }
    }

    const curriculum = official.find(item => /curriculum|CCMAS|syllabus/i.test(`${item.kind} ${item.title}`));
    const officialList = document.querySelector('#official-list');
    officialList.replaceChildren();
    if (curriculum) {
      document.querySelector('#curriculum-title').textContent = curriculum.title;
      document.querySelector('#curriculum-copy').textContent = curriculum.description;
      document.querySelector('#curriculum-link').href = curriculum.url;
    }
    const examResources = official.filter(item => item !== curriculum);
    if (examResources.length) {
      officialList.replaceChildren(...examResources.map((resource, index) => makeResultCard(resource, index)));
    }
    if (searchMode === 'ai' && !guides.length && !document.querySelector('#result-message').textContent) document.querySelector('#result-message').textContent = 'No topic source was found to ground this answer. Try a more specific question or switch to Nigerian curriculum search.';
  } catch (error) {
    document.querySelector('#result-count').textContent = 'We couldn’t reach the learning sources';
    document.querySelector('#result-message').textContent = `${error.message} Try again or check your internet connection.`;
  }
}

async function askFollowup(question) {
  const prompt = String(question || '').trim();
  if (!prompt) return;
  document.querySelector('#result-message').textContent = 'Getting a sourced follow-up…';
  try {
    const resources = await window.CuriumResources.search(queryField.value.trim(), {
      country: 'NG', educationLevel: savedProfile.education, classLevel: savedProfile.level,
      course: subjectField.value.trim() || savedProfile.course, department: savedProfile.department
    });
    const response = await fetch('/api/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: prompt, history: conversation, profile: { education: savedProfile.education, level: savedProfile.level, course: subjectField.value.trim() || savedProfile.course, department: savedProfile.department }, sources: resources.map(({ title, source, description, url }) => ({ title, source, description, url })) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI services are unavailable.');
    conversation.push({ role: 'user', content: prompt }, { role: 'assistant', content: data.answer });
    answerThread.append(makeAIAnswer(data.answer, prompt, data.provider, data.sources || []));
    document.querySelector('#result-message').textContent = `Answered by ${data.provider}. Ask another follow-up or use “Go further” for more sources.`;
    answerThread.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    document.querySelector('#result-message').textContent = `${error.message || 'The AI services are unavailable.'} Try again or search the Nigerian curriculum.`;
  }
}

function makeAIAnswer(answerText, question, provider, sources) {
  const turn = document.createElement('article'); turn.className = 'answer-turn';
  const prompt = document.createElement('span'); prompt.className = 'answer-question'; prompt.textContent = question;
  const title = document.createElement('h3'); title.textContent = `Answer · ${provider}`;
  const body = document.createElement('p'); body.textContent = answerText;
  const sourceList = document.createElement('div'); sourceList.className = 'answer-source';
  if (sources.length) {
    sourceList.append('Sources: ');
    sources.forEach((source, index) => {
      if (index) sourceList.append(' · ');
      const link = document.createElement('a'); link.href = source.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = `[${index + 1}] ${source.title}`; sourceList.append(link);
    });
  } else sourceList.textContent = 'No external sources were available for this answer.';
  const save = document.createElement('button'); save.type = 'button'; save.className = 'save-answer'; save.textContent = 'Save this answer';
  save.addEventListener('click', () => {
    const saved = readSaved('curiumSavedResources', []);
    const url = sources[0]?.url || location.href;
    if (!saved.some(item => item.title === `Answer: ${question}` && item.description === answerText)) {
      saved.push({ title: `Answer: ${question}`, source: `Curium · ${provider}`, url, description: answerText }); saveValue('curiumSavedResources', saved);
    }
    save.textContent = 'Saved ✓'; save.disabled = true;
  });
  turn.append(prompt, title, body, sourceList, save); return turn;
}

function setSearchMode(mode) {
  searchMode = mode;
  modeAI.setAttribute('aria-pressed', String(mode === 'ai'));
  modeCurriculum.setAttribute('aria-pressed', String(mode === 'curriculum'));
  loadResults();
}
modeAI.addEventListener('click', () => setSearchMode('ai'));
modeCurriculum.addEventListener('click', () => setSearchMode('curriculum'));

followupForm.addEventListener('submit', event => {
  event.preventDefault();
  const question = followupInput.value.trim();
  if (!question) return;
  followupInput.value = '';
  askFollowup(question);
});

document.querySelectorAll('[data-followup]').forEach(button => button.addEventListener('click', () => askFollowup(button.dataset.followup)));

async function openFurtherResults() {
  moreResults.hidden = false;
  goFurther.disabled = true;
  goFurther.textContent = 'Finding related sources…';
  try {
    const related = await window.CuriumResources.searchRelated(queryField.value.trim());
    const primaryTitle = answerThread.querySelector('.answer-turn h3')?.textContent;
    const extras = related.filter(item => item.title !== primaryTitle);
    resultList.replaceChildren(...extras.map((resource, index) => makeResultCard(resource, index)));
    goFurther.hidden = true;
    if (currentSearch.goal === 'research') await loadResearchPapers();
  } catch {
    goFurther.disabled = false;
    goFurther.textContent = 'Could not load more sources · Try again';
  }
}

goFurther.addEventListener('click', openFurtherResults);

async function loadResearchPapers() {
  if (showPapers.dataset.loaded === 'true') {
    researchMore.hidden = false;
    showPapers.hidden = true;
    researchMore.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  showPapers.disabled = true;
  showPapers.textContent = 'Finding open access papers…';
  try {
    const papers = await window.CuriumResources.searchPapers(queryField.value.trim());
    researchList.replaceChildren(...papers.map((paper, index) => makeResultCard(paper, index)));
    if (!papers.length) {
      showPapers.disabled = false;
      showPapers.textContent = 'No open access papers found · Try again';
      return;
    }
    showPapers.dataset.loaded = 'true';
  } catch {
    showPapers.disabled = false;
    showPapers.textContent = 'Could not load papers · Try again';
    return;
  }
  researchMore.hidden = false;
  showPapers.hidden = true;
  researchMore.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

showPapers.addEventListener('click', loadResearchPapers);

resultsForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new URLSearchParams({ q: queryField.value.trim(), goal: document.querySelector('#results-goal').value, subject: subjectField.value.trim() });
  document.querySelectorAll('#exam-options input:checked').forEach(input => data.append('exam', input.value));
  history.replaceState(null, '', `results.html?${data.toString()}`);
  currentSearch.goal = data.get('goal');
  currentSearch.exams = data.getAll('exam');
  loadResults();
});

document.querySelectorAll('#exam-options input').forEach(input => { input.checked = currentSearch.exams.includes(input.value); });
document.querySelector('#save-search').addEventListener('click', event => {
  const saved = readSaved('curiumSavedResources', []);
  const searchResource = { title: `Search: ${queryField.value.trim()}`, source: 'Curium search', url: location.href, description: 'Saved search for your learning space.' };
  if (!saved.some(item => item.url === searchResource.url)) saved.push(searchResource);
  saveValue('curiumSavedResources', saved);
  event.currentTarget.textContent = 'Search saved ✓';
});

loadResults();
