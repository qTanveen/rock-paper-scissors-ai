const STATES = {
  LOBBY: 'lobby',
  LOADING: 'loading',
  READY: 'ready',
  COUNTDOWN: 'countdown',
  RESULT: 'result'
};

let gameState = STATES.LOBBY;
let playerScore = 0;
let aiScore = 0;
let drawScore = 0;
let roundNumber = 1;
let isMuted = false;

// Current recognized player gesture in real-time
let detectedGesture = 'None'; 
// The gesture locked in at the end of the countdown
let lockedPlayerGesture = null;

// MediaPipe & Webcam reference
let webcamStream = null;
let cameraHelper = null;
let modelLoaded = false;
let handPresent = false;

// Audio Context (initialized on user interaction)
let audioCtx = null;

// --- DOM ELEMENTS ---
const webcamElement = document.getElementById('webcam');
const canvasOverlay = document.getElementById('canvas-overlay');
const ctxOverlay = canvasOverlay.getContext('2d');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');

// Overlays
const overlayScreen = document.getElementById('overlay-screen');
const overlayLobby = document.getElementById('overlay-lobby');
const overlayLoading = document.getElementById('overlay-loading');
const overlayCountdown = document.getElementById('overlay-countdown');
const countdownNumber = document.getElementById('countdown-number');

// Action Buttons
const startCameraBtn = document.getElementById('start-camera-btn');
const playRoundBtn = document.getElementById('play-round-btn');
const resetGameBtn = document.getElementById('reset-game-btn');

// Matchup / Scoreboard UI
const roundText = document.getElementById('round-text');
const playerScoreText = document.getElementById('player-score');
const aiScoreText = document.getElementById('ai-score');
const drawScoreText = document.getElementById('draw-score');

const playerCard = document.getElementById('player-card');
const aiCard = document.getElementById('ai-card');
const playerGestureIcon = document.getElementById('player-gesture-icon');
const playerGestureLabel = document.getElementById('player-gesture-label');
const aiGestureIcon = document.getElementById('ai-gesture-icon');
const aiGestureLabel = document.getElementById('ai-gesture-label');

const resultBanner = document.getElementById('result-banner');
const resultVerdict = document.getElementById('result-verdict');
const resultReason = document.getElementById('result-reason');

// Icons Mapping
const GESTURE_ICONS = {
  Rock: '<i data-lucide="hand-fist" style="width: 2.5rem; height: 2.5rem; color: var(--primary);"></i>',
  Paper: '<i data-lucide="hand" style="width: 2.5rem; height: 2.5rem; color: var(--success);"></i>',
  Scissors: '<i data-lucide="scissors" style="width: 2.5rem; height: 2.5rem; color: var(--accent);"></i>',
  None: '<i data-lucide="help-circle" style="width: 2.5rem; height: 2.5rem; color: var(--text-muted);"></i>',
  user: '<i data-lucide="user" style="width: 2.5rem; height: 2.5rem; color: var(--text-muted);"></i>',
  bot: '<i data-lucide="bot" style="width: 2.5rem; height: 2.5rem; color: var(--text-muted);"></i>'
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  // Re-run lucide icons markup
  lucide.createIcons();
  setupEventListeners();
  createBackgroundParticles();
});

// --- EVENT LISTENERS ---
function setupEventListeners() {
  startCameraBtn.addEventListener('click', initCameraAndModel);
  playRoundBtn.addEventListener('click', startRoundCountdown);
  resetGameBtn.addEventListener('click', resetScores);
  toggleAudioBtn.addEventListener('click', toggleAudio);
  
  // Resize canvas overlay when window resizes
  window.addEventListener('resize', resizeCanvas);
}

// --- AUDIO SYNTHESIS (WEB AUDIO API) ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function toggleAudio() {
  isMuted = !isMuted;
  const icon = toggleAudioBtn.querySelector('i');
  if (isMuted) {
    icon.setAttribute('data-lucide', 'volume-x');
  } else {
    icon.setAttribute('data-lucide', 'volume-2');
  }
  lucide.createIcons({ attrs: { class: 'lucide-icon' } });
}

function playTickSound() {
  if (isMuted) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

function playShootSound() {
  if (isMuted) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.25);
  gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}

function playWinSound() {
  if (isMuted) return;
  initAudio();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.08);
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + index * 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + index * 0.08 + 0.2);
    
    osc.start(audioCtx.currentTime + index * 0.08);
    osc.stop(audioCtx.currentTime + index * 0.08 + 0.2);
  });
}

function playLoseSound() {
  if (isMuted) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(293.66, audioCtx.currentTime); // D4
  osc.frequency.linearRampToValueAtTime(146.83, audioCtx.currentTime + 0.4); // D3
  gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
}

function playTieSound() {
  if (isMuted) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(392.00, audioCtx.currentTime); // G4
  gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}

// --- PARTICLE SYSTEMS ---
function createBackgroundParticles() {
  const container = document.getElementById('particle-container');
  const particleCount = 25;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.backgroundColor = Math.random() > 0.5 ? 'var(--primary)' : 'var(--secondary)';
    particle.style.opacity = (Math.random() * 0.15 + 0.05).toString();
    const size = Math.random() * 6 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.borderRadius = '50%';
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.left = `${Math.random() * 100}%`;
    
    // Smooth infinite floating animation
    particle.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px)` }
    ], {
      duration: Math.random() * 10000 + 10000,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out'
    });
    
    container.appendChild(particle);
  }
}

function triggerCelebration(isWin) {
  const rect = canvasOverlay.getBoundingClientRect();
  const colors = isWin ? ['#00ff87', '#00f2fe', '#9b51e0'] : ['#ff3b30', '#ff007a'];
  const particleCount = 40;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Choose random point inside card container for burst origin
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight / 2;
    
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    
    const size = Math.random() * 8 + 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.boxShadow = `0 0 10px ${particle.style.backgroundColor}`;
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 200 + 100;
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    particle.style.setProperty('--x', `${targetX}px`);
    particle.style.setProperty('--y', `${targetY}px`);
    
    document.body.appendChild(particle);
    
    particle.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { transform: `translate3d(${targetX}px, ${targetY}px, 0) scale(0)`, opacity: 0 }
    ], {
      duration: Math.random() * 800 + 600,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    });
    
    setTimeout(() => particle.remove(), 1500);
  }
}

// --- WEBCAM AND MODEL SETUP ---
async function initCameraAndModel() {
  updateStatus('loading', 'Loading Model...');
  overlayLobby.classList.add('hidden');
  overlayLoading.classList.remove('hidden');
  
  try {
    // 1. Request Webcam access
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    });
    webcamElement.srcObject = webcamStream;
    
    // Wait for video metadata to load so sizes are established
    await new Promise((resolve) => {
      webcamElement.onloadedmetadata = () => {
        resolve();
      };
    });
    
    resizeCanvas();
    
    // 2. Initialize MediaPipe Hands
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });
    
    hands.onResults(onHandResults);
    
    // 3. Setup Camera Helper to push frames to MediaPipe Hands
    cameraHelper = new Camera(webcamElement, {
      onFrame: async () => {
        if (gameState !== STATES.RESULT) {
          await hands.send({ image: webcamElement });
        }
      },
      width: 640,
      height: 480
    });
    
    await cameraHelper.start();
    
    modelLoaded = true;
    overlayScreen.classList.remove('active');
    overlayLoading.classList.add('hidden');
    
    changeGameState(STATES.READY);
    updateStatus('active', 'Camera Active');
    
  } catch (err) {
    console.error("Camera/Model loading failed: ", err);
    updateStatus('error', 'Webcam Error');
    alert("Could not access camera or load model. Please ensure camera permissions are allowed.");
    
    // Revert overlay
    overlayLobby.classList.remove('hidden');
    overlayLoading.classList.add('hidden');
  }
}

function updateStatus(stateClass, text) {
  statusDot.className = `pulse-dot ${stateClass}`;
  statusText.textContent = text;
}

function resizeCanvas() {
  canvasOverlay.width = webcamElement.clientWidth;
  canvasOverlay.height = webcamElement.clientHeight;
}

// --- MEDIAPIPE ONRESULTS PROCESSING ---
function onHandResults(results) {
  // Clear overlay canvas
  ctxOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handPresent = true;
    const landmarks = results.multiHandLandmarks[0];
    
    // Draw neon skeleton
    drawHandSkeleton(landmarks);
    
    // Perform real-time gesture recognition
    detectedGesture = classifyGesture(landmarks);
    
    // In READY or COUNTDOWN states, update live UI preview
    if (gameState === STATES.READY || gameState === STATES.COUNTDOWN) {
      playerGestureLabel.textContent = detectedGesture;
      updateGestureIcon(playerGestureIcon, detectedGesture);
      
      // Keep "Start Round" active when a hand is successfully in view
      if (gameState === STATES.READY) {
        playRoundBtn.removeAttribute('disabled');
      }
    }
  } else {
    handPresent = false;
    detectedGesture = 'None';
    
    if (gameState === STATES.READY || gameState === STATES.COUNTDOWN) {
      playerGestureLabel.textContent = 'Waiting for hand...';
      updateGestureIcon(playerGestureIcon, 'user');
      
      if (gameState === STATES.READY) {
        playRoundBtn.setAttribute('disabled', 'true');
      }
    }
  }
}

// Drawing helper
function drawHandSkeleton(landmarks) {
  const w = canvasOverlay.width;
  const h = canvasOverlay.height;
  
  // Neon Cyberpunk styling
  ctxOverlay.lineWidth = 4;
  ctxOverlay.strokeStyle = 'rgba(0, 242, 254, 0.7)';
  ctxOverlay.shadowBlur = 8;
  ctxOverlay.shadowColor = '#00f2fe';
  
  // Finger chains definitions
  const chains = [
    [0, 1, 2, 3, 4],       // Thumb
    [5, 6, 7, 8],          // Index
    [9, 10, 11, 12],       // Middle
    [13, 14, 15, 16],      // Ring
    [17, 18, 19, 20],      // Pinky
    [0, 5, 9, 13, 17, 0]   // Palm Base
  ];
  
  // Draw Connection Lines
  chains.forEach(chain => {
    ctxOverlay.beginPath();
    ctxOverlay.moveTo(landmarks[chain[0]].x * w, landmarks[chain[0]].y * h);
    for (let i = 1; i < chain.length; i++) {
      ctxOverlay.lineTo(landmarks[chain[i]].x * w, landmarks[chain[i]].y * h);
    }
    ctxOverlay.stroke();
  });
  
  // Draw Joint Nodes
  ctxOverlay.shadowBlur = 4;
  ctxOverlay.shadowColor = '#9b51e0';
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    ctxOverlay.beginPath();
    // Accent color for tips, primary/secondary for joints
    ctxOverlay.fillStyle = [4, 8, 12, 16, 20].includes(i) ? 'var(--accent)' : 'var(--secondary)';
    ctxOverlay.arc(pt.x * w, pt.y * h, 6, 0, 2 * Math.PI);
    ctxOverlay.fill();
  }
  
  // Reset shadows
  ctxOverlay.shadowBlur = 0;
}

// --- GESTURE RECOGNITION CLASSIFICATION ENGINE ---
function classifyGesture(landmarks) {
  // Landmarks indices:
  // Index tip: 8, joint (pip): 6
  // Middle tip: 12, joint (pip): 10
  // Ring tip: 16, joint (pip): 14
  // Pinky tip: 20, joint (pip): 18
  
  const indexExtended = landmarks[8].y < landmarks[6].y;
  const middleExtended = landmarks[12].y < landmarks[10].y;
  const ringExtended = landmarks[16].y < landmarks[14].y;
  const pinkyExtended = landmarks[20].y < landmarks[18].y;
  
  // Custom thumb detection (Horizontal distance)
  // Check horizontal spacing between landmark 4 (thumb tip) and landmark 2 or 5.
  // Due to palm face vs back face / left vs right hand, thumb can be extended outwards.
  // We check distance relative to index knuckle (5).
  
  // Simple Robust Logic ignoring thumb first:
  // - Rock: all 4 fingers folded
  // - Paper: all 4 fingers extended
  // - Scissors: index and middle extended, ring and pinky folded
  
  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'Rock';
  } else if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
    return 'Paper';
  } else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return 'Scissors';
  }
  
  // Edge cases / Fallback:
  // If only 3 fingers are extended (like Paper minus Pinky), we can still classify as Paper for generous gameplay.
  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
  if (extendedCount >= 3) {
    return 'Paper';
  }
  if (extendedCount <= 1) {
    return 'Rock';
  }
  
  return 'None';
}

function updateGestureIcon(element, gestureName) {
  element.innerHTML = GESTURE_ICONS[gestureName] || GESTURE_ICONS.None;
  lucide.createIcons();
}

// --- GAME STATE MACHINE ---
function changeGameState(newState) {
  gameState = newState;
  
  switch(gameState) {
    case STATES.READY:
      overlayScreen.classList.remove('active');
      overlayCountdown.classList.add('hidden');
      resultBanner.classList.add('hidden');
      
      playerCard.className = 'versus-card';
      aiCard.className = 'versus-card';
      
      updateGestureIcon(aiGestureIcon, 'bot');
      aiGestureLabel.textContent = 'Waiting...';
      
      if (handPresent) {
        playRoundBtn.removeAttribute('disabled');
      }
      break;
      
    case STATES.COUNTDOWN:
      playRoundBtn.setAttribute('disabled', 'true');
      overlayScreen.classList.add('active');
      overlayCountdown.classList.remove('hidden');
      resultBanner.classList.add('hidden');
      break;
      
    case STATES.RESULT:
      overlayScreen.classList.remove('active');
      overlayCountdown.classList.add('hidden');
      resultBanner.classList.remove('hidden');
      break;
  }
}

// --- ROUND COUNTDOWN AND PLAY LOOP ---
function startRoundCountdown() {
  if (gameState !== STATES.READY) return;
  
  changeGameState(STATES.COUNTDOWN);
  let count = 3;
  countdownNumber.textContent = count;
  playTickSound();
  
  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
      playTickSound();
    } else if (count === 0) {
      countdownNumber.textContent = 'SHOOT!';
      playShootSound();
    } else {
      clearInterval(timer);
      evaluateRound();
    }
  }, 900);
}

// --- WINNER EVALUATION ---
function evaluateRound() {
  // Capture what gesture was detected right when countdown finished
  lockedPlayerGesture = detectedGesture;
  
  // If player did not show a valid hand gesture, we try one fallback check, or count it as 'None' (which defaults to a draw/lose)
  if (lockedPlayerGesture === 'None') {
    lockedPlayerGesture = 'Rock'; // Default fallback so user doesn't get error, or keep it None.
    // Let's be lenient: if hand was detected but we couldn't classify it perfectly, make it 'Rock'.
  }
  
  // Select AI choice
  const choices = ['Rock', 'Paper', 'Scissors'];
  const aiChoice = choices[Math.floor(Math.random() * choices.length)];
  
  // Update Cards to locked positions
  updateGestureIcon(playerGestureIcon, lockedPlayerGesture);
  playerGestureLabel.textContent = lockedPlayerGesture;
  
  updateGestureIcon(aiGestureIcon, aiChoice);
  aiGestureLabel.textContent = aiChoice;
  
  // Determine winner
  let resultVerdictStr = '';
  let resultReasonStr = '';
  let verdictClass = ''; // 'result-win', 'result-lose', 'result-tie'
  
  if (lockedPlayerGesture === aiChoice) {
    resultVerdictStr = 'TIE GAME';
    resultReasonStr = `Both players chose ${lockedPlayerGesture}`;
    verdictClass = 'result-tie';
    drawScore++;
    playTieSound();
  } else if (
    (lockedPlayerGesture === 'Rock' && aiChoice === 'Scissors') ||
    (lockedPlayerGesture === 'Paper' && aiChoice === 'Rock') ||
    (lockedPlayerGesture === 'Scissors' && aiChoice === 'Paper')
  ) {
    resultVerdictStr = 'YOU WIN!';
    resultReasonStr = `${lockedPlayerGesture} beats ${aiChoice}`;
    verdictClass = 'result-win';
    playerScore++;
    
    playerCard.classList.add('winner');
    aiCard.classList.add('loser');
    
    playWinSound();
    triggerCelebration(true);
  } else {
    resultVerdictStr = 'AI BOT WINS';
    resultReasonStr = `${aiChoice} beats ${lockedPlayerGesture}`;
    verdictClass = 'result-lose';
    aiScore++;
    
    aiCard.classList.add('winner');
    playerCard.classList.add('loser');
    
    playLoseSound();
    triggerCelebration(false);
  }
  
  // Update scoreboard numbers
  playerScoreText.textContent = playerScore;
  aiScoreText.textContent = aiScore;
  drawScoreText.textContent = drawScore;
  
  // Update verdict elements
  resultVerdict.className = `result-title ${verdictClass}`;
  resultVerdict.textContent = resultVerdictStr;
  resultReason.textContent = resultReasonStr;
  
  changeGameState(STATES.RESULT);
  
  // Transition to next round setup automatically or via a play again button
  // Let's change button text to "Next Round"
  playRoundBtn.innerHTML = '<i data-lucide="play"></i> Next Round';
  playRoundBtn.removeAttribute('disabled');
  
  // When Next Round is clicked, we reset state to READY and advance round counter
  playRoundBtn.onclick = () => {
    roundNumber++;
    roundText.textContent = `ROUND ${roundNumber}`;
    playRoundBtn.innerHTML = '<i data-lucide="zap"></i> Start Round';
    // Restore default click handler
    playRoundBtn.onclick = startRoundCountdown;
    changeGameState(STATES.READY);
  };
}

// --- RESET GAME STATE ---
function resetScores() {
  playerScore = 0;
  aiScore = 0;
  drawScore = 0;
  roundNumber = 1;
  
  playerScoreText.textContent = playerScore;
  aiScoreText.textContent = aiScore;
  drawScoreText.textContent = drawScore;
  roundText.textContent = `ROUND ${roundNumber}`;
  
  // Reset buttons
  playRoundBtn.innerHTML = '<i data-lucide="zap"></i> Start Round';
  playRoundBtn.onclick = startRoundCountdown;
  
  changeGameState(STATES.READY);
}
