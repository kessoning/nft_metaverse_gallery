import "./style.css";

import * as THREE from "three";

import Stats from "three/addons/libs/stats.module.js";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";

//
// Floor reflector
import ReflectorObject from "./js/ReflectorObject";

// Featured list, for the artworks of the videowall
import featuredList from "./js/FeaturedList";

//

let clock, scene, camera, container, renderer, pmremGenerator;
let stats;

// Reflectors for the floor
let i_reflector, u_reflector;

// Raycaster
let raycaster;

// First Person Gaming stuff
const GRAVITY = 30;

const STEPS_PER_FRAME = 5;

const worldOctree = new Octree();

const playerCollider = new Capsule(
  new THREE.Vector3(0, 0.35, 0),
  new THREE.Vector3(0, 1, 0),
  0.35
);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let playerSpeed = 12.5;

const keyStates = {};

let headBobbing = false;
let headBobbingTimer = 0;

//

let loader, textureLoader;

// The artworks, named after the meshes names in the GLTF file
let painting_A,
  painting_C,
  painting_D,
  painting_E,
  painting_F,
  painting_G,
  painting_video;

// Video is loaded random, so store it as a variable for reference to display its name
let videoWallVideoIndex = 0;

//

init();

//

function init() {
  // CLOCK
  clock = new THREE.Clock();

  // SCENE
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // scene.fog = new THREE.Fog(0x88ccee, 0, 50);

  // CAMERA
  camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.rotation.order = "YXZ";

  //

  container = document.getElementById("container");

  // RENDERER
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    clearAlpha: 1,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);

  //

  // commented out, for development purpose
  // stats = new Stats();
  // stats.domElement.style.position = "absolute";
  // stats.domElement.style.top = "0px";
  // container.appendChild(stats.domElement);

  //

  raycaster = new THREE.Raycaster();

  //

  // Add environment map
  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // Since it is not needed, remove from memory allocation once loaded
  THREE.DefaultLoadingManager.onLoad = function () {
    pmremGenerator.dispose();
  };

  // Load the environment map
  new EXRLoader().load("assets/hdri/hdri1.exr", function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
  });

  //

  // EVENTS
  document.addEventListener("keydown", (event) => {
    keyStates[event.code] = true;
  });

  document.addEventListener("keyup", (event) => {
    keyStates[event.code] = false;
  });

  document.addEventListener("mousedown", () => {
    document.body.requestPointerLock();

    instructions.style.display = "none";
    blocker.style.display = "none";
  });

  document.body.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === document.body) {
      camera.rotation.y -= event.movementX / 500;
      camera.rotation.x -= event.movementY / 500;
    }
  });

  window.addEventListener("resize", onWindowResize);

  //

  loader = new GLTFLoader().setPath("./assets/gltf/");
  textureLoader = new THREE.TextureLoader();

  /* Add the GLTF to the scene, then check all the artworks and add custom ones
   ** Plus, add modified reflectors on the floor to simulate floor reflections
   **
   ** model from https://sketchfab.com/3d-models/vr-staircase-art-gallery-2018-ef87d8f3036543cda051604f7c6e205b */
  loader.load( "vr_staircase_art_gallery_2018.glb", (gltf) => {

      scene.add(gltf.scene);

      // Get the collisions
      worldOctree.fromGraphNode(gltf.scene);

      // Traverse the scene to get all the childrem
      gltf.scene.traverse((child) => {
        // If we get a mesh
        if (child.isMesh) {
          // Compute the normals
          child.geometry.computeVertexNormals();

          // Don't cast shadows, they are baked in the 3D object
          child.castShadow = false;
          child.receiveShadow = false;

          // If the child name is the floor
          // It uses same name for upstairs and downstairs floor
          if (child.name === "floor_Floor_Satin_0") {
            // The size and position of the floor
            // To add the reflector properly
            const box = new THREE.Box3().setFromObject(child);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // width and height of the reflector downstairs
            const i_width = size.x;
            const i_height = size.z;
            // position of the reflector downstairs
            const i_x = center.x;
            const i_y = 0.01;
            const i_z = center.z;
            // The reflector downstairs
            i_reflector = new ReflectorObject( i_width, i_height, renderer, camera, scene );
            i_reflector.setPosition(i_x, i_y, i_z);
            i_reflector.setRotation(-Math.PI / 2, 0, 0);
            scene.add(i_reflector.mesh);

            // width and height of the reflector upstairs
            const u_width = size.x * 0.55;
            const u_height = size.z;
            // position of the reflector upstairs
            const u_x = center.x - size.x * 0.22;
            const u_y = 0.01 + size.y;
            const u_z = center.z;
            // The reflector upstairs
            u_reflector = new ReflectorObject( u_width, u_height, renderer, camera, scene );
            u_reflector.setPosition(u_x, u_y, u_z);
            u_reflector.setRotation(-Math.PI / 2, 0, 0);
            scene.add(u_reflector.mesh);
          }

          // videowall
          if (child.name === "paintings_floor_0") {
            // Get size and position of the artwork
            // This will need some adjustment as it is a bit messy
            const box = new THREE.Box3().setFromObject(child);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // width, height, and position
            const width = size.x * 0.945;
            const height = size.y * 0.2975;
            const x = center.x + 0.14;
            const y = center.y * 0.383;
            const z = center.z + 1.451;
            // The geometry
            const geometry = new THREE.PlaneGeometry(width, height, 2, 2);
            // Material
            const material = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.BackSide });
            // Mesh and placement
            painting_video = new THREE.Mesh(geometry, material);
            painting_video.position.set(x, y, z);
            painting_video.name = "videowall"; // object name, for raycasting
            scene.add(painting_video);

            let videoTexture = null;
            let video;

            // load a random video from the list and play it as texture of the videowall
            // A promise, so we are sure it gets loaded before applying the texture
            let loadVideo = new Promise((resolve) => {
              videoWallVideoIndex = Math.floor( Math.random() * featuredList.length );
              video = document.createElement("video");
              const videoname = featuredList[videoWallVideoIndex].video_mp4;
              const videoSource = "assets/videos/" + videoname;
              video.src = videoSource;
              return resolve();
            });

            loadVideo.then(() => {
              video.muted = true; // Mute the video
              video.loop = true; // Loop the video
              const isPlaying =
                video.currentTime > 0 &&
                !video.paused &&
                !video.ended &&
                video.readyState > video.HAVE_CURRENT_DATA;

              // If the video is not playing, play it
              if (!isPlaying) {
                video.play();
              }
              // Video parameters
              videoTexture = new THREE.VideoTexture(video);
              videoTexture.offset = new THREE.Vector2(1, 0);
              videoTexture.minFilter = THREE.LinearFilter;
              videoTexture.magFilter = THREE.LinearFilter;
              videoTexture.format = THREE.RGBAFormat;
              videoTexture.wrapS = THREE.MirroredRepeatWrapping;
              videoTexture.wrapT = THREE.MirroredRepeatWrapping;
              // Apply the video texture
              painting_video.material.map = videoTexture;
              painting_video.material.needsUpdate = true;
            });

            // Remove the mesh from the GLTF visibility
            // As it makes glitches with the added mesh on front
            child.visible = false;
          }

          // downstairs, bottom right
          if (child.name === "paintings_C_0") {
            // Since the first painting on the right has the values completely messed up from the GLTF
            // I add this here so I just need to translate it
            {
              // Get size and position of the artowork
              // This will need some adjustment as it is a bit messy
              const box = new THREE.Box3().setFromObject(child);
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());

              // width, height, and position
              const width = size.x * 1.5;
              const height = size.y * 1.3;
              const x = center.x + 2.615;
              const y = center.y;
              const z = center.z - 0.004;
              // The geometry
              const geometry = new THREE.BoxGeometry( width, height, 0.01, 2, 2, 2 );
              // Material
              const material = [];
              for (let i = 0; i < 6; i++) {
                // 6 materials, one for each side
                // To make the box black
                // The image will be renderer only on the front face
                material[i] = new THREE.MeshStandardMaterial({ color: 0x000000 });
              }
              painting_A = new THREE.Mesh(geometry, material);
              painting_A.position.set(x, y, z);
              painting_A.name = "annihilation";
              scene.add(painting_A);

              // Load random render for this artwork
              const gt = 1 + Math.floor(Math.random() * 9);
              textureLoader.load("assets/generative_tokens/annihilation/" + gt + ".png", (texture) => {
                  // Apply the texture only on the "front" face
                  painting_A.material[4].color = new THREE.Color(0xffffff);
                  painting_A.material[4].map = texture;
                  painting_A.material[4].needsUpdate = true;
                }
              );

              // Remove the mesh from the GLTF visibility
              // As it makes glitches with the added mesh on front
              child.visible = false;
              scene.remove(child);
            }

            // And this is the one at the bottom
            {
              // Get size and position of the artowork
              // This will need some adjustment as it is a bit messy
              const box = new THREE.Box3().setFromObject(child);
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());

              // width, height, and position
              const width = size.x * 1.5;
              const height = size.y * 1.3;
              const x = center.x;
              const y = center.y;
              const z = center.z - 0.004;
              // The geometry
              const geometry = new THREE.BoxGeometry( width, height, 0.01, 2, 2, 2 );
              // Material
              const material = [];
              for (let i = 0; i < 6; i++) {
                // 6 materials, one for each side
                // To make the box black
                // The image will be renderer only on the front face
                material[i] = new THREE.MeshStandardMaterial({ color: 0x000000 });
              }
              painting_C = new THREE.Mesh(geometry, material);
              painting_C.position.set(x, y, z);
              painting_C.name = "aurora";
              scene.add(painting_C);

              // Load random render for this artwork
              const gt = 1 + Math.floor(Math.random() * 8);
              textureLoader.load("assets/generative_tokens/aurora/" + gt + ".png", (texture) => {
                  // Apply the texture only on the "front" face
                  painting_C.material[4].color = new THREE.Color(0xffffff);
                  painting_C.material[4].map = texture;
                  painting_C.material[4].needsUpdate = true;
                }
              );

              // Remove the mesh from the GLTF visibility
              // As it makes glitches with the added mesh on front
              child.visible = false;
              scene.remove(child);
            }
          }

          // upstairs 1
          if (child.name === "paintings_D_0") {
            // Get size and position of the artowork
            // This will need some adjustment as it is a bit messy
            const box = new THREE.Box3().setFromObject(child);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // width, height, and position
            const width = size.x * 1.5;
            const height = size.y * 1.3;
            const x = center.x;
            const y = center.y;
            const z = center.z + 0.004;
            // The geometry
            const geometry = new THREE.BoxGeometry( width, height, 0.01, 2, 2, 2 );
            // Material
            const material = [];
            for (let i = 0; i < 6; i++) {
              // 6 materials, one for each side
              // To make the box black
              // The image will be renderer only on the front face
              material[i] = new THREE.MeshStandardMaterial({ color: 0x000000 });
            }
            painting_D = new THREE.Mesh(geometry, material);
            painting_D.position.set(x, y, z);
            painting_D.name = "aenema";
            scene.add(painting_D);

            // Load random render for this artwork
            const gt = 1 + Math.floor(Math.random() * 6);
            textureLoader.load( "assets/generative_tokens/aenema/" + gt + ".png", (texture) => {
                // Apply the texture only on the "front" face
                painting_D.material[5].color = new THREE.Color(0xffffff);
                painting_D.material[5].map = texture;
                painting_D.material[5].needsUpdate = true;
              }
            );

            // Remove the mesh from the GLTF visibility
            // As it makes glitches with the added mesh on front
            child.visible = false;
            scene.remove(child);
          }

          // upstairs 2
          if (child.name === "paintings_E_0") {
            // Get size and position of the artowork
            // This will need some adjustment as it is a bit messy
            const box = new THREE.Box3().setFromObject(child);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // width, height, and position
            const width = size.x * 1.5;
            const height = size.y * 1.3;
            const x = center.x;
            const y = center.y;
            const z = center.z + 0.004;
            // The geometry
            const geometry = new THREE.BoxGeometry( width, height, 0.01, 2, 2, 2 );
            // Material
            const material = [];
            for (let i = 0; i < 6; i++) {
              // 6 materials, one for each side
              // To make the box black
              // The image will be renderer only on the front face
              material[i] = new THREE.MeshStandardMaterial({ color: 0x000000 });
            }
            painting_E = new THREE.Mesh(geometry, material);
            painting_E.position.set(x, y, z);
            painting_E.name = "lissajous";
            scene.add(painting_E);

            // Load random render for this artwork
            const gt = 1 + Math.floor(Math.random() * 3);
            textureLoader.load("assets/generative_tokens/lissajous/" + gt + ".png", (texture) => {
                // Apply the texture only on the "front" face
                painting_E.material[5].color = new THREE.Color(0xffffff);
                painting_E.material[5].map = texture;
                painting_E.material[5].needsUpdate = true;
              }
            );

            // Remove the mesh from the GLTF visibility
            // As it makes glitches with the added mesh on front
            child.visible = false;
            scene.remove(child);
          }

          // upstairs 3
          if (child.name === "paintings_F_0") {
            // Get size and position of the artowork
            // This will need some adjustment as it is a bit messy
            const box = new THREE.Box3().setFromObject(child);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // width, height, and position
            const width = size.x * 1.5;
            const height = size.y * 1.3;
            const x = center.x;
            const y = center.y;
            const z = center.z - 0.004;
            // The geometry
            const geometry = new THREE.BoxGeometry( width, height, 0.01, 2, 2, 2);
            // Material
            const material = [];
            for (let i = 0; i < 6; i++) {
              // 6 materials, one for each side
              // To make the box black
              // The image will be renderer only on the front face
              material[i] = new THREE.MeshStandardMaterial({ color: 0x000000 });
            }
            painting_F = new THREE.Mesh(geometry, material);
            painting_F.position.set(x, y, z);
            painting_F.name = "monolith";
            scene.add(painting_F);

            // Load random render for this artwork
            const gt = 1 + Math.floor(Math.random() * 6);
            textureLoader.load("assets/generative_tokens/monolith/" + gt + ".png",(texture) => {
                // Apply the texture only on the "front" face
                painting_F.material[4].color = new THREE.Color(0xffffff);
                painting_F.material[4].map = texture;
                painting_F.material[4].needsUpdate = true;
              }
            );

            // Remove the mesh from the GLTF visibility
            // As it makes glitches with the added mesh on front
            child.visible = false;
            scene.remove(child);
          }

          // upstairs 4
          if (child.name === "paintings_G_0") {
            // Get size and position of the artowork
            // This will need some adjustment as it is a bit messy
            const box = new THREE.Box3().setFromObject(child);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // width, height, and position
            const width = size.x * 1.5;
            const height = size.y * 1.3;
            const x = center.x;
            const y = center.y;
            const z = center.z - 0.004;
            // The geometry
            const geometry = new THREE.BoxGeometry( width, height, 0.01, 2, 2, 2 );
            // Material
            const material = [];
            for (let i = 0; i < 6; i++) {
              // 6 materials, one for each side
              // To make the box black
              // The image will be renderer only on the front face
              material[i] = new THREE.MeshStandardMaterial({ color: 0x000000 });
            }
            painting_G = new THREE.Mesh(geometry, material);
            painting_G.position.set(x, y, z);
            painting_G.name = "rhizome";
            scene.add(painting_G);

            // Load random render for this artwork
            const gt = 1 + Math.floor(Math.random() * 7);
            textureLoader.load("assets/generative_tokens/rhizome/" + gt + ".png", (texture) => {
                // Apply the texture only on the "front" face
                painting_G.material[4].color = new THREE.Color(0xffffff);
                painting_G.material[4].map = texture;
                painting_G.material[4].needsUpdate = true;
              }
            );

            // Remove the mesh from the GLTF visibility
            // As it makes glitches with the added mesh on front
            child.visible = false;
            scene.remove(child);
          }

          if (child.name === "leaf_leaf_0") {
            child.material.transparent = true;
          }
        }
      });

      // Once everything is ready, add the "Click to play"
      document.getElementById("loading text").innerHTML = "CLICK TO PLAY";

      // Start the render loop once everything is ready
      renderer.setAnimationLoop(render);
    },

    // Display the loading percentage of the GLTF object
    (xhr) => {
      const percentage = (xhr.loaded / xhr.total) * 100;
      document.getElementById("loading text").innerHTML = "LOADING: " + Math.trunc(percentage) + "%";
    }
  );
}

// On Window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Player collisions with the surrounding world
function playerCollisions() {
  const result = worldOctree.capsuleIntersect(playerCollider);

  playerOnFloor = false;

  if (result) {
    playerOnFloor = result.normal.y > 0;

    if (!playerOnFloor) {
      playerVelocity.addScaledVector(
        result.normal,
        -result.normal.dot(playerVelocity)
      );
    }

    playerCollider.translate(result.normal.multiplyScalar(result.depth));
  }
}

// Update the player
function updatePlayer(deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1;

  // If player is not on the floor (i.e. after jumping) apply gravity
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;

    // small air resistance
    damping *= 0.1;
  }

  playerVelocity.addScaledVector(playerVelocity, damping);

  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
  playerCollider.translate(deltaPosition);

  if (playerVelocity.length() > 0.1) {
    headBobbing = true;
  }

  playerCollisions();

  camera.position.copy(playerCollider.end);
}

// Head bodding, to simulate the steps when moving
function updateHeadBob(deltaTime) {
  if (headBobbing) {
    const wavelength = Math.PI;
    const nextStep =
      1 + Math.floor(((headBobbingTimer + 0.000001) * 10) / wavelength);
    const nextStepTime = (nextStep * wavelength) / 10;
    let d = playerSpeed === 6 ? deltaTime * 0.75 : deltaTime * 1.5;
    headBobbingTimer = Math.min(headBobbingTimer + d, nextStepTime);
    if (headBobbingTimer === nextStepTime) {
      headBobbing = false;
    }
    playerCollider.end.y += Math.sin(headBobbingTimer * 10) * 0.0005;
  }
}

// Forward vector, meaning the direction we are looking at
function getForwardVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();

  return playerDirection;
}

// Side vector
function getSideVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  playerDirection.cross(camera.up);

  return playerDirection;
}

// Key controls
function controls(deltaTime) {
  // gives a bit of air control

  // RUN!
  if (keyStates["ShiftLeft"]) {
    playerSpeed = 14;
  } else {
    playerSpeed = 6;
  }

  const speedDelta = deltaTime * (playerOnFloor ? playerSpeed : 4);

  if (keyStates["KeyW"]) {
    playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
  }

  if (keyStates["KeyS"]) {
    playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
  }

  if (keyStates["KeyA"]) {
    playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
  }

  if (keyStates["KeyD"]) {
    playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
  }

  // Jump!
  if (playerOnFloor) {
    if (keyStates["Space"]) {
      playerVelocity.y = 7.5;
    }
  }

  updateHeadBob(deltaTime);
}

function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

  // we look for collisions in substeps to mitigate the risk of
  // an object traversing another too quickly for detection.

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    controls(deltaTime);

    updatePlayer(deltaTime);
  }

  //

  // Check if the camera view is intersecting any object
  // Create a pointer at the center of the screen
  const pointer = new THREE.Vector2();
  // Cast the pointer
  raycaster.setFromCamera(pointer, camera);
  // Check if any added object is intersected (the GLTF is not counted)
  const intersects = raycaster.intersectObjects(scene.children, false);

  // If there is an intersection, display the relative artwork description
  const d = document.getElementById("artwork-name");
  if (intersects.length > 0) {
    if (intersects[0].object.name === "videowall") {
      d.style.visibility = "unset";
      // For the video, we use a JSON file I made
      d.innerHTML = `<p>${featuredList[videoWallVideoIndex].name}, ${featuredList[videoWallVideoIndex].technique}, ${featuredList[videoWallVideoIndex].year}</p>`;
    } else if (intersects[0].object.name === "aenema") {
      d.style.visibility = "unset";
      d.innerHTML = `<p>.aenema, Generative Token on fxHash, 2021</p>`;
    } else if (intersects[0].object.name === "annihilation") {
      d.style.visibility = "unset";
      d.innerHTML = `<p>.annihilation, Generative Token on fxHash, 2021</p>`;
    } else if (intersects[0].object.name === "aurora") {
      d.style.visibility = "unset";
      d.innerHTML = `<p>.aurora, Generative Token on fxHash, 2021</p>`;
    } else if (intersects[0].object.name === "lissajous") {
      d.style.visibility = "unset";
      d.innerHTML = `<p>.lissajous, Generative Token on fxHash, 2021</p>`;
    } else if (intersects[0].object.name === "monolith") {
      d.style.visibility = "unset";
      d.innerHTML = `<p>.monolith, Generative Token on fxHash, 2021</p>`;
    } else if (intersects[0].object.name === "rhizome") {
      d.style.visibility = "unset";
      d.innerHTML = `<p>.rhizome, Generative Token on fxHash, 2021</p>`;
    } else {
      d.style.visibility = "hidden";
      d.innerHTML = "";
    }
    // If we ar enot looking at any artwork, don't display the description box
  } else {
    d.style.visibility = "hidden";
    d.innerHTML = "";
  }
}

function render() {
  // Update everything
  animate();

  //

  // Update the reflectors
  i_reflector.update();
  u_reflector.update();

  //

  // Render the scene
  renderer.render(scene, camera);

  // For debug, I leave it here
  // stats.update();
}
