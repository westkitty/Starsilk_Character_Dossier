declare module "three" {
  const THREE: any;
  export = THREE;
}
declare module "three/addons/controls/OrbitControls.js" {
  export class OrbitControls {
    constructor(camera: any, domElement: HTMLElement);
    target: any;
    enableDamping: boolean;
    dampingFactor: number;
    minDistance: number;
    maxDistance: number;
    update(): void;
    dispose(): void;
  }
}
