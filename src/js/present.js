import { supabase, currentUser } from './supabase.js';
import { bindNavigation, escapeHtml, showAlert } from './ui.js';

await bindNavigation();
const id = new URLSearchParams(location.search).get('id');
const host = document.querySelector('#presenter');
const viewer = await currentUser();
if (!supabase || !id) {
  host.innerHTML = '<div class="alert alert-warning">Open a live session from the session builder.</div>';
} else {
  const { data: session, error } = await supabase.from('polls').select('*, session_slides(*, session_options(*))').eq('id', id).single();
  if (error || !session?.is_session) {
    host.innerHTML = '<div class="alert alert-danger">This live session could not be found.</div>';
  } else if (viewer?.id !== session.owner_id) {
    host.innerHTML = '<div class="alert alert-danger">Only the session host can open presenter mode.</div>';
  } else {
    let activeIndex = Math.max(0, session.session_slides.sort((a, b) => a.position - b.position).findIndex(slide => slide.id === session.active_slide_id));
    const audienceUrl = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}audience.html?code=${encodeURIComponent(session.join_code)}`;
    const render = () => {
      const slide = session.session_slides[activeIndex];
      if (!slide) return;
      host.innerHTML = `<div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4"><div><p class="eyebrow mb-1">PRESENTER MODE · LIVE</p><h1>${escapeHtml(session.title)}</h1><p class="text-secondary mb-0">Slide ${activeIndex + 1} of ${session.session_slides.length}</p></div><a class="btn btn-outline-primary" href="create-session.html">Create another</a></div><section class="present-stage shadow-sm"><p class="eyebrow">${slide.kind === 'info' ? 'INFORMATION' : 'ASK THE ROOM'}</p><h2 class="display-6 mb-4">${escapeHtml(slide.title)}</h2>${slide.kind === 'question' && slide.question_type !== 'open_text' ? `<div class="row g-3">${slide.session_options.sort((a, b) => a.position - b.position).map((option, index) => `<div class="col-md-6"><div class="present-option"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option.label)}</div></div>`).join('')}</div>` : ''}${slide.question_type === 'open_text' ? '<p class="lead text-secondary">Audience responses will appear in your session report.</p>' : ''}</section><section class="card border-0 shadow-sm mt-4 p-4"><div class="d-flex justify-content-between align-items-center"><div><p class="eyebrow mb-1">QUIZ LEADERBOARD</p><h2 class="h5 mb-0">Correct answers</h2></div><span id="leaderboard-total" class="text-secondary small"></span></div><ol id="leaderboard" class="leaderboard mb-0 mt-3"></ol></section><section class="reaction-wall mt-4"><div class="d-flex justify-content-between align-items-center"><div><p class="eyebrow mb-1">LIVE EMOJI REACTIONS</p><h2 class="h5 mb-0">How the room is feeling</h2></div><span id="reaction-total" class="text-secondary small">0 reactions</span></div><div id="reaction-stream" class="reaction-stream mt-3"></div></section><section class="card border-0 shadow-sm mt-4 p-4"><div class="d-flex justify-content-between align-items-center"><div><p class="eyebrow mb-1">AUDIENCE Q&amp;A</p><h2 class="h5 mb-0">Moderate questions</h2></div><span id="question-total" class="text-secondary small"></span></div><div id="question-list" class="vstack gap-2 mt-3"></div></section><section class="host-share mt-4"><div><p class="eyebrow mb-1">AUDIENCE LINK</p><h2 class="h5 mb-1">Join from any phone</h2><p class="small text-secondary mb-2">No app required. Share the code <strong class="letter-code">${escapeHtml(session.join_code)}</strong> or let people scan.</p><button class="btn btn-outline-primary btn-sm" id="copy-audience-link">Copy audience link</button></div><div class="qr-wrap"><div id="session-qr"></div></div></section><div class="d-flex justify-content-between mt-4"><button class="btn btn-outline-primary" id="previous-slide" ${activeIndex === 0 ? 'disabled' : ''}>← Previous</button><button class="btn btn-primary" id="next-slide" ${activeIndex === session.session_slides.length - 1 ? 'disabled' : ''}>Next slide →</button></div>`;
      new window.QRCode(document.querySelector('#session-qr'), { text: audienceUrl, width: 112, height: 112, colorDark: '#0f172a', colorLight: '#ffffff' });
      document.querySelector('#copy-audience-link').addEventListener('click', async () => { await navigator.clipboard.writeText(audienceUrl); showAlert('Audience link copied.', 'success'); });
      document.querySelector('#previous-slide').addEventListener('click', () => changeSlide(activeIndex - 1));
      document.querySelector('#next-slide').addEventListener('click', () => changeSlide(activeIndex + 1));
    };
    async function changeSlide(nextIndex) {
      const oldSlide = session.session_slides[activeIndex];
      const nextSlide = session.session_slides[nextIndex];
      const { error: oldError } = await supabase.from('session_slides').update({ is_active: false }).eq('id', oldSlide.id);
      const { error: nextError } = await supabase.from('session_slides').update({ is_active: true }).eq('id', nextSlide.id);
      const { error: sessionError } = await supabase.from('polls').update({ active_slide_id: nextSlide.id }).eq('id', session.id);
      if (oldError || nextError || sessionError) return showAlert((oldError || nextError || sessionError).message, 'danger');
      activeIndex = nextIndex;
      render();
    }
    render();
    async function refreshReactions() {
      const { data } = await supabase.from('audience_reactions').select('emoji, created_at').eq('poll_id', session.id).order('created_at', { ascending: false }).limit(28);
      const stream = document.querySelector('#reaction-stream');
      if (!stream || !data) return;
      document.querySelector('#reaction-total').textContent = `${data.length} recent reactions`;
      stream.innerHTML = data.map(item => `<span title="Live reaction">${item.emoji}</span>`).join('') || '<span class="text-secondary small">Waiting for the first reaction…</span>';
    }
    async function refreshLeaderboard() {
      const { data } = await supabase.from('session_responses').select('guest_token, session_options(is_correct)').eq('poll_id', session.id);
      const list = document.querySelector('#leaderboard');
      if (!list || !data) return;
      const scores = new Map();
      data.forEach(item => scores.set(item.guest_token, (scores.get(item.guest_token) || 0) + (item.session_options?.is_correct ? 1 : 0)));
      const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      document.querySelector('#leaderboard-total').textContent = `${scores.size} players`;
      list.innerHTML = ranked.map(([token, score], index) => `<li><span><strong>#${index + 1}</strong> Guest ${token.slice(0, 4).toUpperCase()}</span><b>${score} ${score === 1 ? 'point' : 'points'}</b></li>`).join('') || '<li class="text-secondary">Scores will appear after answers arrive.</li>';
    }
    async function refreshQuestions() {
      const { data } = await supabase.from('audience_questions').select('id, body, approved').eq('poll_id', session.id).order('created_at', { ascending: false });
      const list = document.querySelector('#question-list');
      if (!list || !data) return;
      document.querySelector('#question-total').textContent = `${data.length} submitted`;
      list.innerHTML = data.map(item => `<div class="qa-question"><span>${escapeHtml(item.body)}</span><button class="btn btn-sm ${item.approved ? 'btn-success' : 'btn-outline-primary'}" data-question-id="${item.id}" ${item.approved ? 'disabled' : ''}>${item.approved ? 'Approved' : 'Approve'}</button></div>`).join('') || '<p class="text-secondary small mb-0">No questions yet.</p>';
      list.querySelectorAll('[data-question-id]').forEach(button => button.addEventListener('click', async () => { const { error } = await supabase.from('audience_questions').update({ approved: true }).eq('id', button.dataset.questionId); if (error) showAlert(error.message, 'danger'); else refreshQuestions(); }));
    }
    refreshReactions();
    refreshQuestions();
    refreshLeaderboard();
    setInterval(refreshReactions, 2500);
    setInterval(refreshQuestions, 3000);
    setInterval(refreshLeaderboard, 3000);
  }
}
