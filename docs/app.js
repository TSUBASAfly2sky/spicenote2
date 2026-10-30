const storageKey = 'spice-note-v1';
const grades = {3: '基礎を身につける', 2: '知識を広げる', 1: '理解を深める'};
const blank = {customQuestions: [], scopes: {1: [], 2: [], 3: []}, history: [], wrongIds: []};
const saved = (() => { try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; } })();
const state = {data: {...blank, ...saved, scopes: {...blank.scopes, ...(saved.scopes || {})}}, pages: [], baseQuestions: [], spices: [], hasSourcePdfs: false, view: 'home', quiz: null, flash: ''};
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save = () => localStorage.setItem(storageKey, JSON.stringify(state.data));
const allQuestions = () => [...state.baseQuestions, ...state.data.customQuestions];
const pdfFile = (book) => book === 'book-04' ? 'examples-and-scope.pdf' : `${book}.pdf`;
const sourceUrl = (q) => state.hasSourcePdfs && q.source?.book && q.source?.page ? `public/reference/${encodeURIComponent(pdfFile(q.source.book))}#page=${Number(q.source.page)}` : null;
const sourceLabel = (q) => q.source?.book && q.source?.page ? `${q.source.book.replace('book-', '資料')} · PDF ${q.source.page}ページ` : '出典未設定';
const activeScope = (grade) => state.data.scopes[grade]?.length ? state.data.scopes[grade] : state.spices.filter(s => s.grades.includes(Number(grade))).map(s => s.name);
const gradeQuestions = (grade) => allQuestions().filter(q => Number(q.grade) >= Number(grade) && (Number(grade) === 1 || q.type === 'choice') && (!q.spice || activeScope(grade).includes(q.spice)));
function shuffle(items) { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function shuffleOptions(q) { if (q.type !== 'choice') return q; const pairs = shuffle(q.options.map((text, index) => ({text, index}))); return {...q, options: pairs.map(x => x.text), correct: pairs.findIndex(x => x.index === q.correct)}; }
function nav(view) { state.view = view; state.quiz = null; document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view)); render(); window.scrollTo(0, 0); }
function header(kicker, title, subtitle) { return `<div class="page-kicker">${esc(kicker)}</div><h1>${esc(title)}</h1><p class="lead">${esc(subtitle)}</p>`; }
function render() { const content = {home: homeView, practice: practiceView, reference: referenceView, manage: manageView}[state.view](); $('#view').innerHTML = content; attach(); }
function homeView() {
  const solved = state.data.history.reduce((n, h) => n + h.total, 0);
  const correct = state.data.history.reduce((n, h) => n + h.correct, 0);
  return `<section class="hero"><div class="hero-copy"><div class="page-kicker">学ぶ · 解く · 身につく</div><h1>一問ずつ、知識を育てよう。</h1><p class="lead">予想問題を解きながら、スパイス＆ハーブ検定の学習を進められます。</p><button class="button" data-go="practice">問題を解く <span>→</span></button></div><div class="hero-art" aria-hidden="true">✺</div></section>
  <div class="section-head"><div><h2>級を選んで学習</h2><p>教科書と級別一覧をもとにしたオリジナルの予想問題です。上位級では下位級の内容も復習できます。</p></div></div>
  <div class="grade-grid">${[3,2,1].map(g => `<button class="grade-card" data-grade="${g}" style="text-align:left"><span class="grade-label">LEVEL 0${4-g}</span><h3>${g}級</h3><p>${grades[g]}<br>${g === 1 ? '選択式・記述式' : '選択式'}</p><div class="card-bottom"><span>${gradeQuestions(g).length}問を収録</span><span class="arrow">→</span></div></button>`).join('')}</div>
  <div class="section-head"><div><h2>学習の記録</h2><p>このブラウザ内に保存されます。</p></div></div>
  <div class="stats"><div class="stat-card"><span class="label">解いた問題</span><strong>${solved}</strong><small>問</small></div><div class="stat-card"><span class="label">正答率</span><strong>${solved ? Math.round(correct/solved*100) : '—'}${solved ? '%' : ''}</strong><small>選択式と自己採点の合計</small></div><div class="stat-card"><span class="label">見直したい問題</span><strong>${state.data.wrongIds.length}</strong><small>問</small></div></div>
  <div class="section-head"><div><h2>学習資料</h2></div></div><div class="split"><div class="panel"><div class="row"><h3>${state.pages.length ? 'ページを検索' : '公開版の資料'}</h3><span class="pill">${state.pages.length ? `${state.pages.length}ページ` : '問題集のみ'}</span></div><p>${state.pages.length ? '教科書と追加資料のスキャン画像から読み取った文字を検索できます。結果から原本のページを開いて確認してください。' : '教科書PDFとOCR全文は配布していません。各問題の解説には出典ページを表示します。'}</p>${state.pages.length ? '<button class="button secondary" data-go="reference">資料を探す →</button>' : ''}</div><div class="panel"><div class="row"><h3>級別の出題範囲</h3><span class="pill amber">80種</span></div><p>３級25種、２級45種、１級80種を登録済みです。問題例の形式に合わせて、３択と１級の記述を収録しました。</p><button class="button secondary" data-go="manage">データを管理 →</button></div></div>`;
}
function practiceView() {
  if (state.quiz?.finished) return resultView();
  if (state.quiz) return questionView();
  return `${header('PRACTICE', '問題を解く', '級と問題数を選んで、予想問題集を作成します。')}<div class="panel" style="max-width:790px;margin-top:25px"><h2 class="section-title">出題設定</h2><div class="form-row"><div class="field"><label for="quiz-grade">級</label><select id="quiz-grade"><option value="3">3級 · 選択式</option><option value="2">2級 · 選択式</option><option value="1">1級 · 選択式＋記述式</option></select></div><div class="field"><label for="quiz-count">問題数</label><select id="quiz-count"><option value="5">5問</option><option value="10">10問</option><option value="20">20問</option><option value="all">すべて</option></select></div><div class="field"><label for="quiz-type">形式</label><select id="quiz-type"><option value="all">すべて</option><option value="choice">３択のみ</option><option value="written">記述のみ</option></select></div><div class="field"><label for="quiz-mode">出題内容</label><select id="quiz-mode"><option value="all">すべての問題</option><option value="wrong">見直したい問題</option></select></div><button class="button" id="start-quiz">問題集を作成 →</button></div><p class="status-note" id="quiz-availability" style="margin:19px 0 0"></p></div><div class="panel" style="max-width:790px;margin-top:16px"><h3>採点について</h3><p>選択式は自動採点します。1級の記述式は模範解答を見て、自分で採点できます。${state.hasSourcePdfs ? '解説から該当する教科書ページを開けます。' : '解説には出典ページを表示します。'}</p></div>`;
}
function questionView() {
  const quiz = state.quiz, q = quiz.questions[quiz.index], a = quiz.answers[quiz.index];
  const answered = a?.graded;
  const optionHTML = q.type === 'choice' ? `<div class="options">${q.options.map((o, i) => `<button class="option ${a?.choice === i ? 'selected' : ''} ${answered && i === q.correct ? 'correct' : ''} ${answered && a.choice === i && !a.correct ? 'wrong' : ''}" data-option="${i}" ${answered ? 'disabled' : ''}><b>${'ABCD'[i] || i+1}</b><span>${esc(o)}</span></button>`).join('')}</div>` : `<textarea class="written" id="written-answer" placeholder="100字以内で回答してください" maxlength="${q.maxLength || 100}" ${a?.revealed ? 'disabled' : ''}>${esc(a?.text || '')}</textarea>`;
  let feedback = '';
  if (a?.revealed) feedback = `<div class="feedback ${a.graded && !a.correct ? 'wrong' : ''}"><strong>${q.type === 'choice' ? (a.correct ? '正解です' : '正解：' + esc(q.options[q.correct])) : '模範解答'}</strong><p>${q.type === 'written' ? `${esc(q.answer)}<br><br>` : ''}${esc(q.explanation || '')}</p>${sourceUrl(q) ? `<a class="source-link" href="${sourceUrl(q)}" target="_blank" rel="noopener">原本を見る · ${esc(sourceLabel(q))} ↗</a>` : `<span class="mini">出典：${esc(sourceLabel(q))}</span>`}</div>`;
  let action = q.type === 'choice' ? (answered ? `<button class="button" id="next-question">${quiz.index + 1 === quiz.questions.length ? '結果を見る' : '次の問題'} →</button>` : `<button class="button" id="check-answer" ${a?.choice == null ? 'disabled' : ''}>回答する</button>`) : (!a?.revealed ? `<button class="button" id="reveal-answer">模範解答を見る</button>` : !answered ? `<div class="self-grade"><button class="button" data-self="true">合っていた</button><button class="button secondary" data-self="false">見直す</button></div>` : `<button class="button" id="next-question">${quiz.index + 1 === quiz.questions.length ? '結果を見る' : '次の問題'} →</button>`);
  return `<div class="quiz-wrap"><div class="progress-row"><span>${quiz.grade}級 · ${q.type === 'written' ? '記述式' : '選択式'}</span><span>${quiz.index + 1} / ${quiz.questions.length}</span></div><div class="progress-bar"><span style="width:${(quiz.index + 1)/quiz.questions.length*100}%"></span></div><div class="question-card"><div class="question-meta"><span class="pill">${esc(q.category || '教科書')}</span></div><h2>${esc(q.question)}</h2>${optionHTML}${feedback}<div class="question-actions"><button class="button ghost" id="quit-quiz">中断</button>${action}</div></div></div>`;
}
function resultView() {
  const q = state.quiz, total = q.questions.length, correct = q.answers.filter(a => a?.correct).length;
  return `<div class="result-card" style="max-width:650px;margin:40px auto"><div class="page-kicker" style="justify-content:center">RESULT</div><h1>おつかれさまでした</h1><strong>${correct} / ${total}</strong><p>解答を記録しました。間違えた問題は「見直したい問題」からもう一度解けます。</p><div class="result-actions"><button class="button" id="restart-quiz">もう一度解く</button><button class="button secondary" data-go="home">ホームへ</button></div></div>`;
}
function referenceView() {
  if (!state.pages.length) return `${header('TEXTBOOK', '資料について', '公開版では教科書PDFとOCR全文を配布していません。')}<div class="empty">予想問題の解説に出典ページを表示しています。原本の確認には、お手元の教科書をお使いください。</div>`;
  return `${header('TEXTBOOK', '資料を探す', 'OCRで読み取った文字から検索します。表記や改行に誤りがある場合は原本を確認してください。')}<div class="search-row"><input class="search-box" id="search-input" type="search" placeholder="例：シナモン、カレー、歴史" value="${esc(state.query || '')}"><button class="button" id="search-button">検索</button></div><div id="search-content">${renderSearch()}</div>`;
}
function renderSearch() {
  if (!state.pages.length) return '<div class="empty">公開版では教科書PDFとOCR全文を配布していません。予想問題の解説には出典ページを表示します。</div>';
  const query = (state.query || '').trim();
  if (!query) return `<div class="empty">キーワードを入力すると、資料 ${state.pages.length}ページを検索します。</div>`;
  const normalized = query.toLowerCase().replace(/\s/g, '');
  const matches = state.pages.map(p => ({p, hits: p.lines.map((l, i) => ({l, i})).filter(({l}) => l.text.toLowerCase().replace(/\s/g, '').includes(normalized))})).filter(x => x.hits.length || x.p.text.toLowerCase().replace(/\s/g, '').includes(normalized));
  if (!matches.length) return `<div class="empty">「${esc(query)}」に一致するページはありません。別の表記でも試してください。</div>`;
  const cards = matches.slice(0, 40).map(({p, hits}) => { const h = hits[0] || {i:0}, snippet = p.lines.slice(Math.max(0,h.i-2), Math.min(p.lines.length,h.i+4)).map(x => x.text).join('\n'); const safe = esc(snippet).replace(new RegExp(escapeRegExp(esc(query)), 'gi'), m => `<mark>${m}</mark>`); return `<div class="search-result"><div class="meta"><span>${esc(p.source.replace('book-', '資料'))} · PDF ${p.page}ページ</span><span>${hits.length || 1}件以上</span></div><p>${safe}</p>${state.hasSourcePdfs ? `<a href="public/reference/${encodeURIComponent(pdfFile(p.source))}#page=${p.page}" target="_blank" rel="noopener">原本のページを開く ↗</a>` : ''}</div>`; }).join('');
  return `<p class="mini">${matches.length}ページに一致${matches.length > 40 ? ' · 先頭40ページを表示' : ''}</p><div class="search-results">${cards}</div>`;
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function manageView() {
  const counts = [3,2,1].map(g => `${g}級 ${activeScope(g).length}種`).join(' · ');
  return `${header('DATA LIBRARY', 'データ管理', '問題と級別のスパイス一覧を追加できます。データはこのブラウザに保存されます。')}<div class="manage-grid" style="margin-top:25px"><section class="panel"><div class="row"><h2>級別のスパイス一覧</h2><span class="pill amber">${counts}</span></div><p>改行か読点で区切って入力してください。設定すると、スパイスが指定された問題を各級の範囲に絞ります。</p>${[3,2,1].map(g => `<div class="field" style="margin-top:13px"><label for="scope-${g}">${g}級</label><textarea id="scope-${g}" placeholder="例：シナモン、クミン、コリアンダー">${esc(activeScope(g).join('、'))}</textarea></div>`).join('')}<div class="inline-actions"><button class="button" id="save-scopes">一覧を保存</button></div></section><section class="panel"><h2>問題を追加</h2><p>オリジナル問題を追加できます。</p><div class="form-row"><div class="field"><label for="new-grade">級</label><select id="new-grade"><option value="3">3級</option><option value="2">2級</option><option value="1">1級</option></select></div><div class="field"><label for="new-type">形式</label><select id="new-type"><option value="choice">選択式</option><option value="written">記述式</option></select></div></div><div class="field" style="margin-top:12px"><label for="new-question">問題文</label><textarea id="new-question" placeholder="問題を入力"></textarea></div><div class="field" style="margin-top:12px"><label for="new-answers">選択肢（選択式は1行に1つ、正解を先頭に）／模範解答（記述式）</label><textarea id="new-answers" placeholder="正解の選択肢\n誤答の選択肢\n誤答の選択肢"></textarea></div><div class="field" style="margin-top:12px"><label for="new-explanation">解説</label><textarea id="new-explanation" placeholder="根拠や覚え方"></textarea></div><div class="form-row" style="margin-top:12px"><div class="field"><label for="new-spice">スパイス名（任意）</label><input id="new-spice" placeholder="例：シナモン"></div><div class="field"><label for="new-book">資料番号</label><select id="new-book"><option value="">未設定</option><option value="book-01">資料1</option><option value="book-02">資料2</option><option value="book-03">資料3</option></select></div><div class="field"><label for="new-page">PDFページ</label><input id="new-page" type="number" min="1" placeholder="1"></div></div><div class="inline-actions"><button class="button" id="add-question">問題を保存</button></div></section></div>
  <div class="manage-grid" style="margin-top:16px"><section class="panel"><h2>JSONで一括追加</h2><p><code>questions</code> 配列を持つJSON、または問題の配列を読み込みます。既存の手動追加データは保持されます。</p><input class="input-file" type="file" accept=".json,application/json" id="import-file"><div class="inline-actions"><button class="button secondary" id="download-template">入力例を保存</button><button class="button secondary" id="export-data">追加データを書き出す</button></div></section><section class="panel"><h2>収録状況</h2><ul class="small-list"><li>資料OCR：${state.pages.length ? `${state.pages.length}ページ` : '公開版では非配布'}</li><li>予想問題：${state.baseQuestions.length}問</li><li>追加した問題：${state.data.customQuestions.length}問</li><li>級別一覧：${counts}</li></ul><p class="mini">${state.pages.length ? '教科書の文字起こしには誤認識が含まれます。重要な根拠は原本で確認してください。' : '公開版は問題集のみを配布しています。原本はお手元の教科書で確認してください。'}</p></section></div>${state.flash ? `<div class="flash ${state.flash.startsWith('エラー') ? 'error' : ''}">${esc(state.flash)}</div>` : ''}`;
}
function attach() {
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => nav(b.dataset.go));
  document.querySelectorAll('[data-grade]').forEach(b => b.onclick = () => { nav('practice'); $('#quiz-grade').value = b.dataset.grade; availability(); });
  if (state.view === 'practice') {
    if (!state.quiz) { $('#quiz-grade').onchange = () => { if (Number($('#quiz-grade').value) !== 1) $('#quiz-type').value = 'all'; availability(); }; $('#quiz-type').onchange = availability; $('#quiz-mode').onchange = availability; $('#start-quiz').onclick = startQuiz; availability(); }
    else if (state.quiz.finished) { $('#restart-quiz').onclick = () => { state.quiz = null; render(); }; }
    else {
      document.querySelectorAll('[data-option]').forEach(b => b.onclick = () => { const q = state.quiz, a = q.answers[q.index] || {}; a.choice = Number(b.dataset.option); q.answers[q.index] = a; render(); });
      const check = $('#check-answer'); if (check) check.onclick = checkAnswer;
      const reveal = $('#reveal-answer'); if (reveal) reveal.onclick = revealAnswer;
      document.querySelectorAll('[data-self]').forEach(b => b.onclick = () => selfGrade(b.dataset.self === 'true'));
      const next = $('#next-question'); if (next) next.onclick = nextQuestion;
      $('#quit-quiz').onclick = () => { state.quiz = null; render(); };
    }
  }
  if (state.view === 'reference' && state.pages.length) { $('#search-button').onclick = search; $('#search-input').onkeydown = e => { if (e.key === 'Enter') search(); }; }
  if (state.view === 'manage') { $('#save-scopes').onclick = saveScopes; $('#add-question').onclick = addQuestion; $('#import-file').onchange = importQuestions; $('#download-template').onclick = downloadTemplate; $('#export-data').onclick = exportData; }
}
function availability() { const g = Number($('#quiz-grade').value), mode = $('#quiz-mode').value, type = $('#quiz-type').value; $('#quiz-type').querySelector('option[value=written]').disabled = g !== 1; const available = gradeQuestions(g).filter(q => (type === 'all' || q.type === type) && (mode !== 'wrong' || state.data.wrongIds.includes(q.id))); $('#quiz-availability').textContent = `${g}級で出題できる問題：${available.length}問。${g === 1 ? '記述式を含みます。' : 'すべて選択式です。'}出題範囲：${activeScope(g).length}種。`; $('#start-quiz').disabled = !available.length; }
function startQuiz() { const grade = Number($('#quiz-grade').value), mode = $('#quiz-mode').value, type = $('#quiz-type').value; let questions = gradeQuestions(grade).filter(q => (type === 'all' || q.type === type) && (mode !== 'wrong' || state.data.wrongIds.includes(q.id))); questions = shuffle(questions); const count = $('#quiz-count').value; if (count !== 'all') questions = questions.slice(0, Number(count)); if (!questions.length) return; state.quiz = {grade, questions: questions.map(shuffleOptions), index: 0, answers: [], finished: false}; render(); }
function checkAnswer() { const quiz = state.quiz, q = quiz.questions[quiz.index], a = quiz.answers[quiz.index]; if (!a || a.choice == null) return; a.correct = a.choice === q.correct; a.graded = true; a.revealed = true; render(); }
function revealAnswer() { const quiz = state.quiz, a = quiz.answers[quiz.index] || {}; a.text = $('#written-answer').value.trim(); a.revealed = true; quiz.answers[quiz.index] = a; render(); }
function selfGrade(correct) { const quiz = state.quiz, a = quiz.answers[quiz.index]; a.correct = correct; a.graded = true; render(); }
function nextQuestion() { const quiz = state.quiz, q = quiz.questions[quiz.index], a = quiz.answers[quiz.index]; if (!a?.graded) return; if (a.correct) state.data.wrongIds = state.data.wrongIds.filter(id => id !== q.id); else if (!state.data.wrongIds.includes(q.id)) state.data.wrongIds.push(q.id); if (quiz.index + 1 < quiz.questions.length) quiz.index++; else { quiz.finished = true; state.data.history.push({grade: quiz.grade, date: new Date().toISOString(), total: quiz.questions.length, correct: quiz.answers.filter(x => x?.correct).length}); } save(); render(); }
function search() { state.query = $('#search-input').value; $('#search-content').innerHTML = renderSearch(); }
function saveScopes() { for (const g of [1,2,3]) state.data.scopes[g] = [...new Set($(`#scope-${g}`).value.split(/[、,\n\r]+/).map(x => x.trim()).filter(Boolean))]; save(); state.flash = '級別のスパイス一覧を保存しました。'; render(); }
function validQuestion(q) { if (![1,2,3].includes(Number(q.grade))) return '級は1、2、3のいずれかにしてください。'; if (q.type !== 'choice' && q.type !== 'written') return '形式はchoiceまたはwrittenにしてください。'; if (!q.question?.trim()) return '問題文がありません。'; if (q.type === 'choice' && (!Array.isArray(q.options) || q.options.length < 2 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length)) return '選択式には選択肢と正解番号が必要です。'; if (q.type === 'written' && !q.answer?.trim()) return '記述式には模範解答が必要です。'; if (Number(q.grade) !== 1 && q.type === 'written') return '記述式は1級のみに追加できます。'; return null; }
function addQuestion() { const grade = Number($('#new-grade').value), type = $('#new-type').value, lines = $('#new-answers').value.split('\n').map(x => x.trim()).filter(Boolean); const book = $('#new-book').value, page = Number($('#new-page').value); const q = {id: `user-${Date.now()}`, grade, type, question: $('#new-question').value.trim(), explanation: $('#new-explanation').value.trim(), spice: $('#new-spice').value.trim(), category: '追加問題', source: book && page ? {book, page} : null}; if (type === 'choice') { q.options = lines; q.correct = 0; } else q.answer = lines.join('\n'); const error = validQuestion(q); if (error) { state.flash = `エラー：${error}`; render(); return; } state.data.customQuestions.push(q); save(); state.flash = '問題を追加しました。'; render(); }
async function importQuestions(event) { const file = event.target.files[0]; if (!file) return; try { const body = JSON.parse(await file.text()), questions = Array.isArray(body) ? body : body.questions; if (!Array.isArray(questions)) throw Error('questions配列が見つかりません。'); for (const q of questions) { const error = validQuestion(q); if (error) throw Error(error); } for (const q of questions) state.data.customQuestions.push({...q, id: q.id || `import-${crypto.randomUUID()}`}); save(); state.flash = `${questions.length}問を追加しました。`; } catch (e) { state.flash = `エラー：${e.message}`; } render(); }
function download(name, body) { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], {type:'application/json'})); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function downloadTemplate() { download('spice-questions-template.json', {questions:[{id:'example-001',grade:3,type:'choice',question:'問題文',options:['正解','誤答1','誤答2'],correct:0,explanation:'解説',spice:'シナモン',category:'基本',source:{book:'book-01',page:1}},{id:'example-002',grade:1,type:'written',question:'記述問題文',answer:'模範解答',explanation:'採点のポイント',spice:'シナモン',category:'応用',source:{book:'book-01',page:1}}]}); }
function exportData() { download('spice-note-backup.json', state.data); }
async function load() {
  try {
    const [questions, spices] = await Promise.all([
      fetch('public/data/questions.json').then(r => { if (!r.ok) throw Error('問題データを読み込めません'); return r.json(); }),
      fetch('public/data/spices.json').then(r => { if (!r.ok) throw Error('級別一覧を読み込めません'); return r.json(); })
    ]);
    state.baseQuestions = questions;
    state.spices = spices;
    const optionalJson = async (path) => { const response = await fetch(path); return response.ok ? response.json() : []; };
    const [pages, examples, sourcePdf] = await Promise.allSettled([
      optionalJson('public/data/pages.json'),
      optionalJson('public/data/example-pages.json'),
      fetch('public/reference/book-01.pdf', {method: 'HEAD'}).then(r => r.ok)
    ]);
    state.pages = [...(pages.status === 'fulfilled' ? pages.value : []), ...(examples.status === 'fulfilled' ? examples.value : [])];
    state.hasSourcePdfs = sourcePdf.status === 'fulfilled' && sourcePdf.value;
  } catch (error) {
    console.error(error);
    state.flash = `エラー：${error.message}`;
  }
  $('#data-status').textContent = `${state.pages.length ? `資料 ${state.pages.length}ページ · ` : ''}問題 ${allQuestions().length}問`;
  render();
}
document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => nav(b.dataset.view));
load();
