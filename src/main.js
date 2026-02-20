import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createCyberLabel3D,
  getClickableSprites,
  findAssociatedButton,
  resetLabelHighlights,
  highlightLabelForButton,
  updateLabels,
} from './CyberLine.js';

// Configuration: Define buttons with position, url, and label
// Adjust positions to place buttons on your flower petals
// Optional: lineUp (true = line goes up, false = down), lineAngle (degrees, default 45)
const BUTTONS = [
  { id: 'btn1', position: [1.3, -0.2, -0.07], url: 'https://example.com/1', label: 'About' },
  { id: 'btn2', position: [-1.5, 0.8, -0.75], url: '/projects', label: 'Projects' },
  { id: 'btn3', position: [0.45, 1.8, 0.44], url: 'https://example.com/3', label: 'Contact', lineUp: true },
  { id: 'btn4', position: [-0.3, 0, 1.65], url: 'https://github.com/madkate42', label: 'GitHub' },
  { id: 'btn5', position: [-0.35, 0.55, 1.25], url: '/resume', label: 'Resume', lineUp: true },
  { id: 'btn6', position: [1, 1.4, 0.87], url: 'https://www.linkedin.com/in/kbondarenko42/', label: 'LinkedIn', lineUp: true },
];

// Scene setup
const canvas = document.getElementById('canvas');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.5, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(-5, -5, -5);
scene.add(backLight);

// DEBUG: Coordinate helpers (remove when done positioning)
// const axesHelper = new THREE.AxesHelper(3); // X=red, Y=green, Z=blue
// scene.add(axesHelper);

// const gridHelper = new THREE.GridHelper(6, 12, 0x888888, 0x444444);
// scene.add(gridHelper);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Raycaster for click detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Store references
let flowerModel = null;
const clickableButtons = [];

// Parent group for flower + buttons (so they rotate together)
const flowerGroup = new THREE.Group();
scene.add(flowerGroup);

// Slider control with inertia
const rotationSlider = document.getElementById('rotation-slider');
let targetRotation = 0;
let currentRotation = 0;
const inertia = 0.08; // Lower = more smooth/slow, higher = more snappy

rotationSlider.addEventListener('input', (e) => {
  // Map 0-100 to 2.5 full rotations (-2.5π to 2.5π)
  targetRotation = ((e.target.value - 50) / 50) * Math.PI * 2.5;
});

// Create button meshes
const buttonGeometry = new THREE.SphereGeometry(0.15, 16, 16);
const buttonMaterial = new THREE.MeshStandardMaterial({
  color: 0xFFFFFF,
  emissive: 0x444444,
  transparent: true,
  opacity: 0.6,
});

BUTTONS.forEach((config) => {
  const button = new THREE.Mesh(buttonGeometry, buttonMaterial.clone());
  button.position.set(...config.position);
  button.userData = { url: config.url, label: config.label, id: config.id };
  button.userData.originalColor = button.material.color.clone();
  flowerGroup.add(button);
  clickableButtons.push(button);

  // Create 3D cyber label
  createCyberLabel3D(config, button, scene);
});

// Load the GLB model
const loader = new GLTFLoader();

loader.load(
  '/model/flower.glb',
  (gltf) => {
    flowerModel = gltf.scene;
    flowerGroup.add(flowerModel);

    // Hide the cube (Object_04)
    const cube = flowerModel.getObjectByName('Object_4');
    if (cube) cube.visible = false;

    // Rotate model upright
    flowerModel.rotation.y = 0.4;
    flowerModel.rotation.z = -Math.PI / 2 - 0.1;

    // Center the model
    const box = new THREE.Box3().setFromObject(flowerModel);
    const center = box.getCenter(new THREE.Vector3());
    flowerModel.position.sub(center);

    // Scale to fit view
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 6 / maxDim;
    flowerModel.scale.setScalar(scale);

    console.log('Model loaded! Adjust button positions in BUTTONS config.');
  },
  (progress) => {
    const percent = (progress.loaded / progress.total) * 100;
    console.log(`Loading: ${percent.toFixed(1)}%`);
  },
  (error) => {
    console.error('Error loading model:', error);
  }
);

// Mouse move handler for hover effects
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const clickableObjects = [...clickableButtons, ...getClickableSprites()];
  const intersects = raycaster.intersectObjects(clickableObjects);

  // Reset all buttons
  clickableButtons.forEach((btn) => {
    btn.material.color.copy(btn.userData.originalColor);
    btn.scale.setScalar(1);
  });

  // Reset all label opacities
  resetLabelHighlights();

  if (intersects.length > 0) {
    const hoveredObject = intersects[0].object;
    const associatedButton = findAssociatedButton(hoveredObject, clickableButtons);

    if (associatedButton) {
      // Highlight effect
      associatedButton.material.color.copy(associatedButton.userData.originalColor).multiplyScalar(1.5);
      associatedButton.scale.setScalar(1.2);

      // Highlight associated label
      highlightLabelForButton(associatedButton);

      canvas.style.cursor = 'pointer';
    }
  } else {
    canvas.style.cursor = 'grab';
  }
}

// Overlay handling
const overlays = {
  '/projects': document.getElementById('overlay-projects'),
  '/resume': document.getElementById('overlay-resume'),
};

function openOverlay(url) {
  const overlay = overlays[url];
  if (overlay) {
    overlay.classList.add('active');
    // Load PDF only when resume overlay opens
    if (url === '/resume') {
      const embed = document.getElementById('resume-embed');
      if (!embed.src || embed.src === window.location.href) {
        embed.src = '/public/resume.pdf#navpanes=0&zoom=100';
      }
    }
  }
}

function closeOverlay(overlay) {
  overlay.classList.remove('active');
}

// Close button handlers
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const overlay = btn.closest('.overlay');
    if (overlay) closeOverlay(overlay);
  });
});

// Click handler
function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const clickableObjects = [...clickableButtons, ...getClickableSprites()];
  const intersects = raycaster.intersectObjects(clickableObjects);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    const associatedButton = findAssociatedButton(clickedObject, clickableButtons);

    if (associatedButton) {
      console.log('Clicked:', associatedButton.userData.id, associatedButton.userData.label);

      const url = associatedButton.userData.url;
      if (url) {
        // Check if it's an overlay route
        if (overlays[url]) {
          openOverlay(url);
        } else if (url.startsWith('http')) {
          // External links open in new tab
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
      }
    }
  }
}

// Event listeners
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Apply slider rotation with inertia
  currentRotation += (targetRotation - currentRotation) * inertia;
  flowerGroup.rotation.y = currentRotation;

  // Update 3D labels to follow buttons and face camera
  updateLabels(camera);

  renderer.render(scene, camera);
}

animate();
