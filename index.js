
// Hardcoded Karten - passe hier deine Inhalte an
// 'erklaerung' enthält die ausführliche Erklärung (nicht direkt auf Karte sichtbar)
const CARDS = [
  { frage: '1?', antwort: '1', erklaerung: 'Erklärung zu 1' },
  { frage: '2?', antwort: '2', erklaerung: 'Erklärung zu 2' },
  { frage: '3?', antwort: '3', erklaerung: 'Erklärung zu 3' },
  { frage: '4?', antwort: '4', erklaerung: 'Erklärung zu 4' },
  { frage: '5?', antwort: '5', erklaerung: 'Erklärung zu 5' }
];

let currentIndex = 0;
const history = [];

let isTransitioning = false;
let pendingTimeout = null;

const cardRoot = document.getElementById('cardRoot');

const explainArea = document.getElementById('explainArea');
const explainToggle = document.getElementById('explainToggle');
const explainText = document.getElementById('explainText');

let currentTopEl = null;

function updateExplainVisibility(el, cardData){
  if(!explainArea) return;
  if(el && el.classList.contains('flipped')){
    explainArea.classList.remove('hidden');
    explainText.classList.add('hidden');
    explainText.textContent = cardData.erklaerung || '';
  } else {
    explainArea.classList.add('hidden');
    explainText.classList.add('hidden');
    explainText.textContent = '';
  }
}

// toggle explanation text when clicking 'Erklärung'
if(explainToggle){
  explainToggle.addEventListener('click', ()=>{
    if(!currentTopEl) return;
    const visible = !explainText.classList.contains('hidden');
    if(visible){
      explainText.classList.add('hidden');
    } else {
      explainText.classList.remove('hidden');
    }
  });
}

function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function createCardElement(cardData){
  const wrapper = document.createElement('div');
  wrapper.className = 'card';

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  const front = document.createElement('div');
  front.className = 'card-face card-front';
  front.innerHTML = `
    <div class="frage">${escapeHtml(cardData.frage)}</div>
  `;

  const back = document.createElement('div');
  back.className = 'card-face card-back';
  back.innerHTML = `
    <div class="antwort">${escapeHtml(cardData.antwort)}</div>
  `;

  inner.appendChild(front);
  inner.appendChild(back);
  wrapper.appendChild(inner);

  // flip on click (only if it wasn't a drag)
  let moved = false;
  inner.addEventListener('pointerdown', onPointerDown);

  function onPointerDown(ev){
    const startX = ev.clientX;
    let lastX = startX;
    let dragging = false;
    inner.setPointerCapture(ev.pointerId);

    function onMove(e){
        if(isTransitioning) return;
      const dx = e.clientX - startX;
      if(Math.abs(dx) > 6) dragging = true;
      lastX = e.clientX;
      if(dragging){
        // prevent page scrolling while dragging
        try{ e.preventDefault(); }catch(_){}
        wrapper.style.transition = 'none';
        wrapper.classList.add('dragging');
        const rot = Math.sign(dx) * Math.min(12, Math.abs(dx) / 15);
        wrapper.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
        moved = true;
      }
    }

    function onCancel(e){
      // pointer cancelled (e.g., OS gesture) — reset
      cleanupListeners();
      wrapper.classList.remove('dragging');
      wrapper.style.transition = 'transform 160ms ease-out';
      wrapper.style.transform = '';
      setTimeout(()=> moved = false, 20);
    }

    function onUp(e){
      inner.releasePointerCapture(ev.pointerId);
      cleanupListeners();
      wrapper.classList.remove('dragging');
      const totalDx = lastX - startX;
      // lower threshold for mobile to make swiping easier
      const threshold = Math.min(window.innerWidth * 0.07, 60);
      wrapper.style.transition = '';
      if(totalDx < -threshold){
        if(!isTransitioning) swipeLeft(wrapper);
        else wrapper.style.transform = '';
      } else if(totalDx > threshold){
        if(!isTransitioning) swipeRight(wrapper);
        else wrapper.style.transform = '';
      } else {
        // reset
        wrapper.style.transform = '';
      }
      setTimeout(()=> moved = false, 20);
    }

    function cleanupListeners(){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  }

  // click to flip (ignore if a drag happened) and notify listeners
  inner.addEventListener('click', () => {
    if(moved) return;
    const flipped = wrapper.classList.toggle('flipped');
    wrapper.dispatchEvent(new CustomEvent('flipped', { detail: { flipped } }));
  });

  return wrapper;
}

function clearRoot(){
  cardRoot.innerHTML = '';
}

function showCard(index, from){
  // from: 'left' | 'right' | undefined
  const data = CARDS[index];
  const el = createCardElement(data);
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.willChange = 'transform';

  // ensure new card is on top; lower existing children
  Array.from(cardRoot.children).forEach(ch => {
    ch.style.zIndex = 1;
    ch.style.pointerEvents = 'none';
  });
  el.style.zIndex = 10;

  // start position
  if(from === 'right'){
    el.style.transform = `translateX(${window.innerWidth}px)`;
  } else if(from === 'left'){
    el.style.transform = `translateX(-${window.innerWidth}px)`;
  } else {
    el.style.transform = '';
  }

  // append and animate in
  cardRoot.appendChild(el);
  // ensure new card accepts input immediately
  try{ el.style.pointerEvents = 'auto'; }catch(_){ }
  // set current top element and wire flip events
  currentTopEl = el;
  el.addEventListener('flipped', ()=> updateExplainVisibility(el, data));
  // ensure explain area matches initial state (front = hidden)
  updateExplainVisibility(el, data);
  // mark transition state briefly so quick repeated swipes don't stack cards
  isTransitioning = true;
  // clear any pending timeouts
  if(pendingTimeout){ clearTimeout(pendingTimeout); pendingTimeout = null; }
  // force layout/reflow so transition reliably starts on some devices/emulators
  void el.offsetHeight;

  // robustly clear isTransitioning when transition ends; also add timeout fallback
  let cleared = false;
  function clearTransition(){
    if(cleared) return; cleared = true;
    isTransitioning = false;
    if(pendingTimeout){ clearTimeout(pendingTimeout); pendingTimeout = null; }
    el.removeEventListener('transitionend', onTransEnd);
  }
  function onTransEnd(ev){ if(ev.propertyName === 'transform') clearTransition(); }
  el.addEventListener('transitionend', onTransEnd);

  requestAnimationFrame(()=>{
    el.style.transition = 'transform 360ms cubic-bezier(.2,.9,.2,1)';
    // small deferred set to ensure browser applies initial transform first
    setTimeout(()=> el.style.transform = '', 8);
  });

  // fallback: ensure we clear the flag even if transitionend doesn't fire
  pendingTimeout = setTimeout(()=>{ clearTransition(); }, 520);

  // remove extra children (keep only topmost)
  Array.from(cardRoot.children).forEach((ch, i)=>{
    if(ch !== el){
      // keep previous until its out animation completes
    }
  });

  return el;
}

function swipeLeft(el){
  if(isTransitioning) return;
  isTransitioning = true;
  // disable further interaction on the outgoing card
  try{ el.style.pointerEvents = 'none'; }catch(_){}
  // animate out to left, then show new random from right
  el.style.transition = 'transform 280ms ease-in';
  el.style.transform = `translateX(-${window.innerWidth}px) rotate(-10deg)`;
  const prevIndex = currentIndex;
  history.push(prevIndex);
  if(pendingTimeout){ clearTimeout(pendingTimeout); pendingTimeout = null; }
  pendingTimeout = setTimeout(()=>{
    // remove element
    if(el.parentNode) el.parentNode.removeChild(el);
    // pick random new index !== prevIndex
    if(CARDS.length === 0) { isTransitioning = false; pendingTimeout = null; return; }
    let next;
    if(CARDS.length === 1) next = 0; else {
      do { next = Math.floor(Math.random() * CARDS.length); } while(next === prevIndex);
    }
    currentIndex = next;
    // hide explanation area when changing cards
    if(explainArea) explainArea.classList.add('hidden');
    // show incoming card from right
    currentTopEl = null;
    showCard(currentIndex, 'right');
    // isTransitioning flag will be cleared by showCard's timeout
    pendingTimeout = null;
  }, 300);
}

function swipeRight(el){
  if(isTransitioning) return;
  // go back if history available
  if(history.length === 0){
    // bounce back
    el.style.transition = 'transform 220ms cubic-bezier(.2,.9,.2,1)';
    el.style.transform = '';
    return;
  }
  isTransitioning = true;
  // disable further interaction on the outgoing card
  try{ el.style.pointerEvents = 'none'; }catch(_){}
  el.style.transition = 'transform 260ms ease-in';
  el.style.transform = `translateX(${window.innerWidth}px) rotate(10deg)`;
  if(pendingTimeout){ clearTimeout(pendingTimeout); pendingTimeout = null; }
  pendingTimeout = setTimeout(()=>{
    if(el.parentNode) el.parentNode.removeChild(el);
    const prev = history.pop();
    currentIndex = prev;
    if(explainArea) explainArea.classList.add('hidden');
    currentTopEl = null;
    showCard(currentIndex, 'left');
    pendingTimeout = null;
    // showCard will clear isTransitioning
  }, 280);
}

// initial render
function init(){
  if(CARDS.length === 0) return;
  currentIndex = 0;
  clearRoot();
  // show initial card with entrance animation from right to ensure swipe state is ready
  // small timeout to allow layout to settle on some devices
  if(pendingTimeout){ clearTimeout(pendingTimeout); pendingTimeout = null; }
  isTransitioning = false;
  setTimeout(()=> showCard(currentIndex, 'right'), 30);
}

window.addEventListener('resize', ()=>{});

init();

// --- UI: tips and list overlay ---
const tipLeft = document.querySelector('.tip-left');
const tipRight = document.querySelector('.tip-right');
const listButton = document.getElementById('listButton');
const listOverlay = document.getElementById('listOverlay');
const questionList = document.getElementById('questionList');

if(tipLeft){
  tipLeft.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(currentTopEl) swipeLeft(currentTopEl);
  });
}
if(tipRight){
  tipRight.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(currentTopEl) swipeRight(currentTopEl);
  });
}

function openListOverlay(){
  if(!listOverlay) return;
  // populate
  questionList.innerHTML = '';
  CARDS.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = escapeHtml(c.frage || ('Karte ' + (i+1)));
    li.addEventListener('click', ()=>{
      currentIndex = i;
      history.length = 0;
      clearRoot();
      if(explainArea) explainArea.classList.add('hidden');
      currentTopEl = null;
      showCard(currentIndex);
      closeListOverlay();
    });
    questionList.appendChild(li);
  });
  listOverlay.classList.remove('hidden');
}

function closeListOverlay(){
  if(!listOverlay) return;
  listOverlay.classList.add('hidden');
}

if(listButton){
  listButton.addEventListener('click', ()=>{
    if(!listOverlay) return openListOverlay();
    if(listOverlay.classList.contains('hidden')) openListOverlay(); else closeListOverlay();
  });
}

if(listOverlay){
  listOverlay.addEventListener('click', (e)=>{
    // close when clicking outside the panel
    if(e.target === listOverlay) closeListOverlay();
  });
  const closeBtn = listOverlay.querySelector('.overlay-close');
  if(closeBtn) closeBtn.addEventListener('click', closeListOverlay);
}