import { bindNavigation, getPolls, pollCard, showAlert } from './ui.js';

await bindNavigation();
const ballot = document.querySelector('#landing-ballot');
if (ballot && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const replayBallotDrop = () => { ballot.classList.remove('is-dropping'); void ballot.offsetWidth; ballot.classList.add('is-dropping'); };
  replayBallotDrop();
  setInterval(replayBallotDrop, 4200);
}
const grid = document.querySelector('#poll-grid');
if (grid) {
  try {
    const polls = await getPolls();
    grid.innerHTML = polls.map(pollCard).join('') || '<p class="text-secondary">No public polls yet. Be the first to create one.</p>';
  } catch (error) { showAlert(error.message, 'danger'); }
}
