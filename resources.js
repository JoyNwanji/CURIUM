// Free public sources for Curium's learning resource search.

(() => {
  const WIKIPEDIA_SEARCH = 'https://en.wikipedia.org/w/rest.php/v1/search/page';
  const OPENALEX_WORKS = 'https://api.openalex.org/works';
  const NUC_CCMAS = [
    { name: 'Administration and Management', pattern: /account|administration|banking|business|finance|insurance|management|marketing|taxation|entrepreneurship/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Administration-and-Management.pdf' },
    { name: 'Agriculture', pattern: /agric|animal science|crop|fisheries|forestry|soil science|horticulture/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Agriculture-2023.pdf' },
    { name: 'Allied Health Sciences', pattern: /nurs|radiograph|medical lab|public health|physiotherap|health information/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Allied-Health-Sciences-2023.pdf' },
    { name: 'Architecture', pattern: /architect|landscape architecture|interior architecture/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Architecture-CCMAS-2023-FINAL.pdf' },
    { name: 'Arts', pattern: /\barts?\b|creative|english|literature|history|language|music|theatre|philosophy|religious/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Arts-CCMAS-2023-FINAL.pdf' },
    { name: 'Basic Medical Sciences', pattern: /anatomy|biochem|physiology|pharmacology/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Basic-Medical-Sciences-CCMAS-FINAL-December-26-2022.pdf' },
    { name: 'Computing', pattern: /computer|computing|cyber|data science|information technology|software|artificial intelligence/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Computing-CCMAS-2023-FINAL.pdf' },
    { name: 'Communication and Media Studies', pattern: /communication|journalism|mass media|broadcast|film|multimedia/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Communication-and-Media-Studies-CCMAS-2023-FINAL.pdf' },
    { name: 'Education', pattern: /education|teaching|curriculum studies/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Education-CCMAS-2023-New.pdf' },
    { name: 'Engineering and Technology', pattern: /engineering|mechatronic|telecommunication|technology/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Engineering-Technology-CCMAS-2023-FINAL.pdf' },
    { name: 'Environmental Sciences', pattern: /environment|estate management|geography|quantity survey|urban and regional|surveying/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Environmental-Sciences-CCMAS-2023-FINAL.pdf' },
    { name: 'Law', pattern: /\blaw\b|legal|ll\.b/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Law-ALL.pdf' },
    { name: 'Medicine and Dentistry', pattern: /medicine|dentistry|dental/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Medicine-and-Dentistry-CCMAS-2023-FINAL.pdf' },
    { name: 'Pharmacy and Pharmaceutical Sciences', pattern: /pharmacy|pharmaceutical/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Pharmacy-and-Pharmaceutical-Sciences-CCMAS-2023-FINAL.pdf' },
    { name: 'Sciences', pattern: /biology|botany|chemistry|geology|mathematics|microbiology|physics|statistics|zoology/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Sciences-CCMAS-2023-FINAL.pdf' },
    { name: 'Social Sciences', pattern: /economics|political science|psychology|sociology|international relations|criminology|social science/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Social-Sciences-CCMAS-FINAL-2023-A.pdf' },
    { name: 'Veterinary Medicine', pattern: /veterinary|vet medicine/i, url: 'https://www.nuc.edu.ng/wp-content/uploads/2026/03/Veterinary-Medicine-CCMAS-2023-FINAL.pdf' }
  ];

  async function readJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Resource search failed (${response.status}).`);
    return response.json();
  }

  function plainText(value = '') {
    return value.replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim();
  }

  async function searchWikipedia(query, limit = 1) {
    const url = new URL(WIKIPEDIA_SEARCH);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '6');
    const data = await readJson(url);

    return Promise.all((data.pages || []).slice(0, limit).map(async page => {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
      try {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
        const summary = await readJson(summaryUrl);
        return {
          source: 'Wikipedia', kind: 'overview', title: page.title,
          description: plainText(summary.extract || page.description || page.excerpt || 'General reference article.'),
          url: summary.content_urls?.desktop?.page || url
        };
      } catch {
        return { source: 'Wikipedia', kind: 'overview', title: page.title,
          description: plainText(page.description || page.excerpt || 'General reference article.'), url };
      }
    }));
  }

  async function searchOpenAlex(query) {
    const url = new URL(OPENALEX_WORKS);
    url.searchParams.set('search', query);
    url.searchParams.set('filter', 'is_oa:true');
    url.searchParams.set('per_page', '6');
    url.searchParams.set('select', 'id,display_name,publication_year,authorships,open_access,primary_location,type');
    const data = await readJson(url);

    return (data.results || []).map(work => {
      const authors = (work.authorships || [])
        .map(entry => entry.author && entry.author.display_name)
        .filter(Boolean)
        .slice(0, 3);

      return {
        source: 'OpenAlex',
        kind: 'open-access research',
        title: work.display_name || 'Untitled research work',
        description: [authors.join(', '), work.publication_year, work.type]
          .filter(Boolean).join(' · ') || 'Open-access scholarly work.',
        url: (work.open_access && work.open_access.oa_url)
          || (work.primary_location && work.primary_location.landing_page_url)
          || work.id
      };
    });
  }

  function getNigeriaCurriculumSources(learner = {}) {
    const level = String(learner.educationLevel || learner.level || '').toLowerCase();
    const query = [learner.course, learner.department, learner.subject].filter(Boolean).join(' ');
    const hasUniversityContext = /university|tertiary|undergrad/.test(level)
      || /\b\d{3}\s*level\b|\byear\s*[1-6]\b/.test(level)
      || Boolean(learner.course);
    const sources = [];

    if (hasUniversityContext) {
      const discipline = NUC_CCMAS.find(item => item.pattern.test(query));
      sources.push({
        source: 'National Universities Commission (Nigeria)',
        kind: 'official university curriculum benchmark',
        title: discipline ? `NUC CCMAS · ${discipline.name}` : `NUC CCMAS${query ? ` · ${query}` : ''}`,
        description: `${discipline ? `${discipline.name} national course and learning standards. ` : 'Browse Nigeria’s national minimum academic standards by discipline. '}Confirm the semester course list with your university, which may add institution-specific courses.`,
        url: discipline ? discipline.url : 'https://www.nuc.edu.ng/ccmas/'
      });
      if (/jamb/i.test(learner.exam || '') || learner.includeAdmissions) {
        sources.push({
          source: 'JAMB',
          kind: 'official admissions and UTME syllabus',
          title: 'JAMB Integrated Brochure and Syllabus System (IBASS)',
          description: 'Check programme eligibility, subject combinations, and the current JAMB e-syllabus.',
          url: 'https://ibass.jamb.gov.ng/'
        });
      }
      return sources;
    }

    const classLevel = String(learner.classLevel || learner.level || '').toLowerCase();
    const isSeniorSecondary = /ss|sss|senior/.test(classLevel);
    sources.push({
      source: 'Nigerian Educational Research and Development Council (NERDC)',
      kind: 'official national curriculum',
      title: isSeniorSecondary ? 'Revised Senior Secondary Curriculum' : 'Revised Basic Education Curriculum',
      description: isSeniorSecondary
        ? 'Browse the official Nigerian SSS 1–3 curriculum by subject.'
        : 'Browse the official Nigerian primary and JSS curriculum by class and subject.',
      url: isSeniorSecondary
        ? 'https://nerdc.gov.ng/content_manager/new_senior_curriculum_home.html'
        : 'https://nerdc.gov.ng/content_manager/new_curriculum_home.html'
    });

    const exams = Array.isArray(learner.exams) ? learner.exams : [learner.exam].filter(Boolean);
    if (exams.some(exam => /waec/i.test(exam))) {
      sources.push({
        source: 'WAEC',
        kind: 'official exam learning resource',
        title: 'WAEC e-Learning',
        description: 'Find subject study guides and exam insights across arts, languages, sciences, business, and technical subjects.',
        url: 'https://www.waeconline.org.ng/e-Learning/index.htm'
      });
    }
    if (exams.some(exam => /neco/i.test(exam))) {
      sources.push({
        source: 'NECO',
        kind: 'official exam information',
        title: 'NECO official publications and syllabus information',
        description: 'Check current syllabus access, examination documents, and notices on NECO’s official site.',
        url: 'https://neco.gov.ng/'
      });
    }
    if (exams.some(exam => /jamb|utme/i.test(exam)) || learner.includeAdmissions) {
      sources.push({
        source: 'JAMB',
        kind: 'official admissions and UTME syllabus',
        title: 'JAMB Integrated Brochure and Syllabus System (IBASS)',
        description: 'Check programme eligibility, subject combinations, and the current JAMB e-syllabus.',
        url: 'https://ibass.jamb.gov.ng/'
      });
    }
    return sources;
  }

  async function search(query, learner = {}) {
    const term = String(query || '').trim();
    if (!term) return [];

    const results = await Promise.allSettled([searchWikipedia(term, 1)]);
    const resources = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    if (String(learner.country || 'NG').toUpperCase() === 'NG') {
      resources.push(...getNigeriaCurriculumSources(learner));
    }

    if (resources.length === 0) {
      throw new Error('No learning resources are available right now. Please try again shortly.');
    }

    return resources;
  }

  async function searchPapers(query) {
    return searchOpenAlex(String(query || '').trim());
  }

  async function searchRelated(query) {
    return searchWikipedia(String(query || '').trim(), 5);
  }

  window.CuriumResources = { search, searchPapers, searchRelated, getNigeriaCurriculumSources };
})();
