import { Mesh, PlaneGeometry } from "three";

import Reflector from "../libs/Reflector";

export default class {
  constructor(width, height, renderer, camera, scene) {
    this.mesh = new Mesh(new PlaneGeometry(width, height));
    this.mesh.material = new Reflector(renderer, camera, scene, this.mesh, {
      resolution: 1024,
      blur: [256, 256],
      mixBlur: 2,
      mixContrast: 1,
      mirror: 1,
      depthScale: 1,
      depthToBlurRatioBias: 0.25,
    });
    this.mesh.material.setValues({
      transparent: true,
      opacity: 0.25,
    });
  }

  setPosition = (x, y, z) => {
    this.mesh.position.x = x;
    this.mesh.position.y = y;
    this.mesh.position.z = z;
  };

  setRotation = (x, y, z) => {
    this.mesh.rotateX(x);
    this.mesh.rotateY(y);
    this.mesh.rotateZ(z);
  }

  update = () => {
    this.mesh.material.update();
  };
}
