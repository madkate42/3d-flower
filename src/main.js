import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration: Define buttons with position, url, and label
// Adjust positions to place buttons on your flower petals
// Optional: lineUp (true = line goes up, false = down), lineAngle (degrees, default 45)
const BUTTONS = [
  { id: 'btn1', position: [1.3, -0.2, -0.07], url: 'https://example.com/1', label: 'About' },
  { id: 'btn2', position: [-1.5, 0.8, -0.75], url: 'https://example.com/2', label: 'Projects' },
  { id: 'btn3', position: [0.5, 1.8, 0.5], url: 'https://example.com/3', label: 'Contact', lineUp: true },
  { id: 'btn4', position: [-0.3, 0, 1.65], url: 'https://github.com/madkate42', label: 'GitHub' },
  { id: 'btn5', position: [-0.35, 0.55, 1.25], url: 'https://example.com/4', label: 'Resume', lineUp: true },
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
camera.position.set(0, 2, 5);
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
const labelGroups = []; // 3D label groups that billboard with camera

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

// Create text sprite for labels
function createTextSprite(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 256;
  canvas.height = 64;

  context.font = 'bold 28px "Courier New", monospace';
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text.toUpperCase(), canvas.width / 2, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.0, 0.25, 1);

  return sprite;
}

// Create 3D cyber label (lines + text) that billboards with camera
function createCyberLabel3D(config, button) {
  const group = new THREE.Group();

  // Line parameters
  const diagonalLength = 0.8;
  const horizontalLength = 1.6;

  // Points for the line (diagonal down, then horizontal)
  // Direction will be updated in animate loop
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(diagonalLength * 0.7, -diagonalLength * 0.7, 0),
    new THREE.Vector3(diagonalLength * 0.7 + horizontalLength, -diagonalLength * 0.7, 0)
  ];

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
  });

  const line = new THREE.Line(lineGeometry, lineMaterial);
  group.add(line);

  // Small dot at the end
  const dotGeometry = new THREE.SphereGeometry(0.03, 8, 8);
  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
  });
  const dot = new THREE.Mesh(dotGeometry, dotMaterial);
  dot.position.copy(points[2]);
  group.add(dot);

  // Text sprite
  const textSprite = createTextSprite(config.label);
  textSprite.position.set(
    points[1].x + horizontalLength / 2 + 0.1,
    points[1].y - 0.15,
    0
  );
  textSprite.userData = { url: config.url, label: config.label, id: config.id };
  group.add(textSprite);

  // Store references
  const lineUp = config.lineUp || false;
  const lineAngle = (config.lineAngle || 45) * Math.PI / 180; // Convert to radians

  group.userData = {
    button: button,
    config: config,
    line: line,
    lineGeometry: lineGeometry,
    dot: dot,
    textSprite: textSprite,
    diagonalLength: diagonalLength,
    horizontalLength: horizontalLength,
    lineUp: lineUp,
    lineAngle: lineAngle
  };

  // Add to scene (not flowerGroup - it will follow button position but orient to camera)
  scene.add(group);

  return group;
}

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
  const labelGroup = createCyberLabel3D(config, button);
  labelGroups.push(labelGroup);
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

// Get all clickable objects (buttons + text sprites)
function getClickableObjects() {
  const objects = [...clickableButtons];
  labelGroups.forEach(group => {
    objects.push(group.userData.textSprite);
  });
  return objects;
}

// Find button associated with clicked object
function findAssociatedButton(clickedObject) {
  if (clickableButtons.includes(clickedObject)) {
    return clickedObject;
  }
  const labelGroup = labelGroups.find(g => g.userData.textSprite === clickedObject);
  return labelGroup ? labelGroup.userData.button : null;
}

// Mouse move handler for hover effects
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const clickableObjects = getClickableObjects();
  const intersects = raycaster.intersectObjects(clickableObjects);

  // Reset all buttons
  clickableButtons.forEach((btn) => {
    btn.material.color.copy(btn.userData.originalColor);
    btn.scale.setScalar(1);
  });

  // Reset all label opacities
  labelGroups.forEach((group) => {
    group.userData.line.material.opacity = 0.6;
    group.userData.textSprite.material.opacity = 0.85;
  });

  if (intersects.length > 0) {
    const hoveredObject = intersects[0].object;
    const associatedButton = findAssociatedButton(hoveredObject);

    if (associatedButton) {
      // Highlight effect
      associatedButton.material.color.copy(associatedButton.userData.originalColor).multiplyScalar(1.5);
      associatedButton.scale.setScalar(1.2);

      // Highlight associated label
      const labelGroup = labelGroups.find(g => g.userData.button === associatedButton);
      if (labelGroup) {
        labelGroup.userData.line.material.opacity = 1;
        labelGroup.userData.textSprite.material.opacity = 1;
      }

      canvas.style.cursor = 'pointer';
    }
  } else {
    canvas.style.cursor = 'grab';
  }
}

// Click handler
function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const clickableObjects = getClickableObjects();
  const intersects = raycaster.intersectObjects(clickableObjects);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    const associatedButton = findAssociatedButton(clickedObject);

    if (associatedButton) {
      console.log('Clicked:', associatedButton.userData.id, associatedButton.userData.label);

      if (associatedButton.userData.url) {
        window.open(associatedButton.userData.url, '_blank');
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

// Update label positions and orientations
function updateLabels() {
  // Get camera's horizontal direction (ignore Y component for horizontal billboard)
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();

  // Calculate the "right" vector relative to camera (for horizontal lines)
  const cameraRight = new THREE.Vector3();
  cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

  labelGroups.forEach((group) => {
    const { button, diagonalLength, horizontalLength, lineGeometry, dot, textSprite, lineUp, lineAngle } = group.userData;

    // Get button's world position
    const buttonWorldPos = new THREE.Vector3();
    button.getWorldPosition(buttonWorldPos);

    // Position the label group at the button
    group.position.copy(buttonWorldPos);

    // Determine direction based on button's screen position
    const buttonScreenPos = buttonWorldPos.clone().project(camera);
    const goRight = buttonScreenPos.x >= 0;
    const directionMultiplier = goRight ? 1 : -1;

    // Calculate new line points based on camera orientation
    const verticalDirection = lineUp ? 1 : -1;
    const horizontalComponent = Math.cos(lineAngle) * diagonalLength;
    const verticalComponent = Math.sin(lineAngle) * diagonalLength * verticalDirection;

    const diagonalEnd = new THREE.Vector3()
      .addScaledVector(cameraRight, horizontalComponent * directionMultiplier)
      .add(new THREE.Vector3(0, verticalComponent, 0));

    const horizontalEnd = diagonalEnd.clone()
      .addScaledVector(cameraRight, horizontalLength * directionMultiplier);

    // Update line geometry
    const positions = lineGeometry.attributes.position.array;
    // Point 0: origin (0, 0, 0)
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;
    // Point 1: diagonal end
    positions[3] = diagonalEnd.x;
    positions[4] = diagonalEnd.y;
    positions[5] = diagonalEnd.z;
    // Point 2: horizontal end
    positions[6] = horizontalEnd.x;
    positions[7] = horizontalEnd.y;
    positions[8] = horizontalEnd.z;

    lineGeometry.attributes.position.needsUpdate = true;

    // Update dot position
    dot.position.copy(horizontalEnd);

    // Update text position - place beyond the end of the line
    const textOffsetDistance = 0.3 * directionMultiplier;
    const textVerticalOffset = lineUp ? 0.15 : -0.15;
    textSprite.position.set(
      horizontalEnd.x + (cameraRight.x * textOffsetDistance),
      horizontalEnd.y + textVerticalOffset,
      horizontalEnd.z + (cameraRight.z * textOffsetDistance)
    );
  });
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Apply slider rotation with inertia
  currentRotation += (targetRotation - currentRotation) * inertia;
  flowerGroup.rotation.y = currentRotation;

  // Update 3D labels to follow buttons and face camera
  updateLabels();

  renderer.render(scene, camera);
}

animate();
