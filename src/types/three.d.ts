declare module 'three' {
  export class Color {
    constructor(color?: string | number)
  }

  export class Euler {
    constructor(x?: number, y?: number, z?: number)
    x: number
    y: number
    z: number
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number)
    x: number
    y: number
    z: number
    set(x: number, y: number, z: number): this
    clone(): Vector3
    copy(v: Vector3): this
    add(v: Vector3): this
    sub(v: Vector3): this
    multiplyScalar(s: number): this
    length(): number
    normalize(): this
    distanceTo(v: Vector3): number
    lerp(v: Vector3, alpha: number): this
  }

  export class Matrix4 {}

  export class Object3D {
    position: Vector3
    scale: Vector3
    rotation: Euler
    visible: boolean
    matrix: Matrix4
    updateMatrix(): void
  }

  export class Scene {
    background: Color | null
    add(...objects: Object3D[]): this
  }

  export class PerspectiveCamera extends Object3D {
    constructor(fov: number, aspect: number, near: number, far: number)
    aspect: number
    lookAt(x: number | Vector3, y?: number, z?: number): void
    updateProjectionMatrix(): void
  }

  export type WebGLRendererParameters = {
    antialias?: boolean
    alpha?: boolean
  }

  export class WebGLRenderer {
    constructor(parameters?: WebGLRendererParameters)
    domElement: HTMLCanvasElement
    setPixelRatio(value: number): void
    setSize(width: number, height: number, updateStyle?: boolean): void
    render(scene: Scene, camera: PerspectiveCamera): void
    dispose(): void
  }

  export class Light extends Object3D {
    constructor(color?: number, intensity?: number)
  }

  export class AmbientLight extends Light {}
  export class DirectionalLight extends Light {}

  export class BufferGeometry {}
  export class PlaneGeometry extends BufferGeometry {
    constructor(width: number, height: number)
    dispose(): void
  }
  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number)
    dispose(): void
  }
  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number)
    dispose(): void
  }

  export type MeshStandardMaterialParameters = {
    color?: string | number
    roughness?: number
    metalness?: number
    emissive?: Color
    emissiveIntensity?: number
  }

  export class Material {
    transparent: boolean
    opacity: number
    dispose(): void
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: MeshStandardMaterialParameters)
  }

  export class Mesh<TGeometry extends BufferGeometry = BufferGeometry, TMaterial extends Material = Material> extends Object3D {
    constructor(geometry?: TGeometry, material?: TMaterial)
    geometry: TGeometry
    material: TMaterial
  }

  export class GridHelper extends Object3D {
    constructor(size: number, divisions: number, colorCenterLine?: string | number, colorGrid?: string | number)
    material: Material
  }

  export const DynamicDrawUsage: number

  export type InstancedBufferAttributeLike = {
    setUsage: (usage: number) => void
    needsUpdate: boolean
  }

  export class InstancedMesh<
    TGeometry extends BufferGeometry = BufferGeometry,
    TMaterial extends Material = Material,
  > extends Mesh<TGeometry, TMaterial> {
    constructor(geometry: TGeometry, material: TMaterial, count: number)
    instanceMatrix: InstancedBufferAttributeLike
    count: number
    setMatrixAt(index: number, matrix: Matrix4): void
  }
}


