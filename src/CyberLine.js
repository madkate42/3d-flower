import * as THREE from 'three';

const labelGroups = [];

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

export function createCyberLabel3D(config, button, scene) {
  const group = new THREE.Group();

  // Line parameters
  const diagonalLength = 0.8;
  const horizontalLength = 1.6;

  // Points for the line (diagonal down, then horizontal)
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
  const lineAngle = (config.lineAngle || 45) * Math.PI / 180;

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

  scene.add(group);
  labelGroups.push(group);

  return group;
}

export function getLabelGroups() {
  return labelGroups;
}

export function getClickableSprites() {
  return labelGroups.map(group => group.userData.textSprite);
}

export function findAssociatedButton(clickedObject, clickableButtons) {
  if (clickableButtons.includes(clickedObject)) {
    return clickedObject;
  }
  const labelGroup = labelGroups.find(g => g.userData.textSprite === clickedObject);
  return labelGroup ? labelGroup.userData.button : null;
}

export function resetLabelHighlights() {
  labelGroups.forEach((group) => {
    group.userData.line.material.opacity = 0.6;
    group.userData.textSprite.material.opacity = 0.85;
  });
}

export function highlightLabelForButton(button) {
  const labelGroup = labelGroups.find(g => g.userData.button === button);
  if (labelGroup) {
    labelGroup.userData.line.material.opacity = 1;
    labelGroup.userData.textSprite.material.opacity = 1;
  }
}

export function updateLabels(camera) {
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();

  const cameraRight = new THREE.Vector3();
  cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

  labelGroups.forEach((group) => {
    const { button, diagonalLength, horizontalLength, lineGeometry, dot, textSprite, lineUp, lineAngle } = group.userData;

    const buttonWorldPos = new THREE.Vector3();
    button.getWorldPosition(buttonWorldPos);

    group.position.copy(buttonWorldPos);

    const buttonScreenPos = buttonWorldPos.clone().project(camera);
    const goRight = buttonScreenPos.x >= 0;
    const directionMultiplier = goRight ? 1 : -1;

    const verticalDirection = lineUp ? 1 : -1;
    const horizontalComponent = Math.cos(lineAngle) * diagonalLength;
    const verticalComponent = Math.sin(lineAngle) * diagonalLength * verticalDirection;

    const diagonalEnd = new THREE.Vector3()
      .addScaledVector(cameraRight, horizontalComponent * directionMultiplier)
      .add(new THREE.Vector3(0, verticalComponent, 0));

    const horizontalEnd = diagonalEnd.clone()
      .addScaledVector(cameraRight, horizontalLength * directionMultiplier);

    const positions = lineGeometry.attributes.position.array;
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;
    positions[3] = diagonalEnd.x;
    positions[4] = diagonalEnd.y;
    positions[5] = diagonalEnd.z;
    positions[6] = horizontalEnd.x;
    positions[7] = horizontalEnd.y;
    positions[8] = horizontalEnd.z;

    lineGeometry.attributes.position.needsUpdate = true;

    dot.position.copy(horizontalEnd);

    const textOffsetDistance = 0.3 * directionMultiplier;
    const textVerticalOffset = lineUp ? 0.15 : -0.15;
    textSprite.position.set(
      horizontalEnd.x + (cameraRight.x * textOffsetDistance),
      horizontalEnd.y + textVerticalOffset,
      horizontalEnd.z + (cameraRight.z * textOffsetDistance)
    );
  });
}
