import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const ARENA_SIZE = 60
const HALF_ARENA = ARENA_SIZE / 2

const BASE_SPEED = 8.0 // units/sec
const TURN_SPEED = 2.3 // rad/sec
const SEGMENT_SPACING = 0.6
const BASE_LENGTH = 5.5
const LENGTH_PER_SCORE = 0.85

const FOOD_RADIUS = 0.38
const HEAD_RADIUS = 0.75

type ControlsState = {
  keySteerLeft: boolean
  keySteerRight: boolean
  keyFaster: boolean
  keySlower: boolean
  touchSteerAxis: number // -1..1
  touchSpeedAxis: number // -1..1 (negative=faster, positive=slower)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function wrapCoord(value: number): number {
  const m = ((value + HALF_ARENA) % ARENA_SIZE + ARENA_SIZE) % ARENA_SIZE
  return m - HALF_ARENA
}

function wrapDelta(delta: number): number {
  const m = ((delta + HALF_ARENA) % ARENA_SIZE + ARENA_SIZE) % ARENA_SIZE
  return m - HALF_ARENA
}

function wrapVectorXZ(v: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(wrapCoord(v.x), v.y, wrapCoord(v.z))
}

function wrapVectorXZToNearest(vWrapped: THREE.Vector3, reference: THREE.Vector3): THREE.Vector3 {
  const kx = Math.round((reference.x - vWrapped.x) / ARENA_SIZE)
  const kz = Math.round((reference.z - vWrapped.z) / ARENA_SIZE)
  return new THREE.Vector3(vWrapped.x + kx * ARENA_SIZE, vWrapped.y, vWrapped.z + kz * ARENA_SIZE)
}

function torusDistanceXZ(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = wrapDelta(a.x - b.x)
  const dz = wrapDelta(a.z - b.z)
  return Math.hypot(dx, dz)
}

function smoothAlpha(dt: number, responsiveness: number): number {
  return 1 - Math.exp(-responsiveness * dt)
}

function randBetween(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng()
}

function randomFoodPosition(rng: () => number): THREE.Vector3 {
  const margin = 1.6
  return new THREE.Vector3(
    randBetween(rng, -HALF_ARENA + margin, HALF_ARENA - margin),
    0,
    randBetween(rng, -HALF_ARENA + margin, HALF_ARENA - margin),
  )
}

function forwardFromYaw(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize()
}

export function Snake3DGame() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const resetGameRef = useRef<(() => void) | null>(null)

  const rng = useMemo(() => () => Math.random(), [])

  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem('snake3d_best_score')
      const parsed = raw ? Number(raw) : 0
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  })
  const [isPaused, setIsPaused] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [cameraMode, setCameraMode] = useState<'head' | 'chase'>('chase')

  const [showTouchControls, setShowTouchControls] = useState(false)
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isWallWrapEnabled, setIsWallWrapEnabled] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('snake3d_walls_wrap')
      return raw === null ? true : raw === '1'
    } catch {
      return true
    }
  })
  const [steerSensitivity, setSteerSensitivity] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem('snake3d_steer_sens')
      const parsed = raw ? Number(raw) : 1
      return Number.isFinite(parsed) ? clamp(parsed, 0.6, 1.8) : 1
    } catch {
      return 1
    }
  })
  const [isHapticsEnabled, setIsHapticsEnabled] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('snake3d_haptics')
      return raw === null ? true : raw === '1'
    } catch {
      return true
    }
  })

  const joystickActiveRef = useRef(false)
  const joystickPointerIdRef = useRef<number | null>(null)

  const scoreRef = useRef(0)
  const cameraModeRef = useRef<'head' | 'chase'>('chase')
  const steerSensitivityRef = useRef(steerSensitivity)
  const isHapticsEnabledRef = useRef(isHapticsEnabled)
  const isWallWrapEnabledRef = useRef(isWallWrapEnabled)

  const headPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const yawRef = useRef(0)
  const spineRef = useRef<THREE.Vector3[]>([])
  const foodPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const headWrapShiftRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 })

  const controlsRef = useRef<ControlsState>({
    keySteerLeft: false,
    keySteerRight: false,
    keyFaster: false,
    keySlower: false,
    touchSteerAxis: 0,
    touchSpeedAxis: 0,
  })

  const isPausedRef = useRef(false)
  const isGameOverRef = useRef(false)

  useEffect(() => {
    scoreRef.current = score
    if (score > bestScore) setBestScore(score)
  }, [score, bestScore])

  useEffect(() => {
    try {
      window.localStorage.setItem('snake3d_best_score', String(bestScore))
    } catch {
      // ignore
    }
  }, [bestScore])

  useEffect(() => {
    cameraModeRef.current = cameraMode
  }, [cameraMode])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    isGameOverRef.current = isGameOver
  }, [isGameOver])

  useEffect(() => {
    try {
      window.localStorage.setItem('snake3d_steer_sens', String(steerSensitivity))
    } catch {
      // ignore
    }
    steerSensitivityRef.current = steerSensitivity
  }, [steerSensitivity])

  useEffect(() => {
    try {
      window.localStorage.setItem('snake3d_haptics', isHapticsEnabled ? '1' : '0')
    } catch {
      // ignore
    }
    isHapticsEnabledRef.current = isHapticsEnabled
  }, [isHapticsEnabled])

  useEffect(() => {
    try {
      window.localStorage.setItem('snake3d_walls_wrap', isWallWrapEnabled ? '1' : '0')
    } catch {
      // ignore
    }
    isWallWrapEnabledRef.current = isWallWrapEnabled
  }, [isWallWrapEnabled])

  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)')
    const compute = () => {
      const coarse = mq?.matches ?? false
      const hasTouch =
        coarse ||
        (typeof navigator !== 'undefined' && 'maxTouchPoints' in navigator && (navigator.maxTouchPoints ?? 0) > 0)
      setShowTouchControls(hasTouch)
    }

    compute()
    mq?.addEventListener?.('change', compute)
    return () => mq?.removeEventListener?.('change', compute)
  }, [])

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!isHapticsEnabledRef.current) return
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1020')

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220)
    camera.position.set(0, 7, 10)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
    const pixelRatioCap = isCoarsePointer ? 1.25 : 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap))
    container.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.85)
    dir.position.set(10, 18, 6)
    scene.add(dir)

    const floorGeom = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE)
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.95,
      metalness: 0.05,
    })
    const floor = new THREE.Mesh(floorGeom, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    scene.add(floor)

    const grid = new THREE.GridHelper(ARENA_SIZE, ARENA_SIZE, '#1f2a44', '#1a2440')
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.6
    grid.position.y = 0.001
    scene.add(grid)

    const wallHalf = HALF_ARENA - 0.6
    const wallHeight = 2.4
    const wallThickness = 0.22
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#60a5fa',
      roughness: 0.6,
      metalness: 0.05,
      emissive: new THREE.Color('#0b3a6b'),
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.18,
    })
    const walls: THREE.Mesh[] = []
    const wallGeomX = new THREE.BoxGeometry(wallThickness, wallHeight, ARENA_SIZE)
    const wallGeomZ = new THREE.BoxGeometry(ARENA_SIZE, wallHeight, wallThickness)

    const wallRight = new THREE.Mesh(wallGeomX, wallMat)
    wallRight.position.set(wallHalf, wallHeight / 2, 0)
    scene.add(wallRight)
    walls.push(wallRight)

    const wallLeft = new THREE.Mesh(wallGeomX, wallMat)
    wallLeft.position.set(-wallHalf, wallHeight / 2, 0)
    scene.add(wallLeft)
    walls.push(wallLeft)

    const wallTop = new THREE.Mesh(wallGeomZ, wallMat)
    wallTop.position.set(0, wallHeight / 2, wallHalf)
    scene.add(wallTop)
    walls.push(wallTop)

    const wallBottom = new THREE.Mesh(wallGeomZ, wallMat)
    wallBottom.position.set(0, wallHeight / 2, -wallHalf)
    scene.add(wallBottom)
    walls.push(wallBottom)

    const maxInstances = 1500
    const segmentGeom = new THREE.BoxGeometry(0.92, 0.92, 0.92)
    const segmentMat = new THREE.MeshStandardMaterial({
      color: '#22c55e',
      roughness: 0.6,
      metalness: 0.1,
      emissive: new THREE.Color('#052e16'),
      emissiveIntensity: 0.5,
    })
    const snakeMesh = new THREE.InstancedMesh(segmentGeom, segmentMat, maxInstances)
    snakeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(snakeMesh)

    const foodGeom = new THREE.SphereGeometry(0.35, 22, 22)
    const foodMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color('#450a0a'),
      emissiveIntensity: 0.65,
    })
    const foodMesh = new THREE.Mesh(foodGeom, foodMat)
    scene.add(foodMesh)

    const headGeom = new THREE.SphereGeometry(0.72, 26, 26)
    const headMat = new THREE.MeshStandardMaterial({
      color: '#34d399',
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color('#064e3b'),
      emissiveIntensity: 1.2,
    })
    const headMesh = new THREE.Mesh(headGeom, headMat)
    scene.add(headMesh)

    const dummy = new THREE.Object3D()

    const resetGame = () => {
      headPosRef.current = new THREE.Vector3(0, 0, 0)
      yawRef.current = 0
      spineRef.current = [headPosRef.current.clone()]
      foodPosRef.current = randomFoodPosition(rng)
      headWrapShiftRef.current = { x: 0, z: 0 }
      scoreRef.current = 0
      setScore(0)
      setIsPaused(false)
      setIsGameOver(false)
      vibrate(10)
    }

    resetGameRef.current = resetGame
    resetGame()

    const setKey = (key: string, isDown: boolean) => {
      const controls = controlsRef.current
      const k = key.toLowerCase()
      if (k === 'a' || k === 'arrowleft') controls.keySteerLeft = isDown
      if (k === 'd' || k === 'arrowright') controls.keySteerRight = isDown
      if (k === 'w' || k === 'arrowup') controls.keyFaster = isDown
      if (k === 's' || k === 'arrowdown') controls.keySlower = isDown
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const isArrow =
        e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight'
      if (isArrow) e.preventDefault()

      if (e.key === ' ' || e.key === 'Spacebar') {
        setIsPaused((p) => !p)
        vibrate(8)
        return
      }

      if (e.key === 'c' || e.key === 'C') {
        setCameraMode((m) => (m === 'head' ? 'chase' : 'head'))
        vibrate(8)
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        if (isGameOverRef.current || isPausedRef.current) resetGame()
        return
      }

      setKey(e.key, true)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      setKey(e.key, false)
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp, { passive: true })

    const resize = () => {
      const { clientWidth, clientHeight } = container
      if (clientWidth <= 0 || clientHeight <= 0) return
      renderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(container)
    resize()

    const cameraPos = camera.position.clone()
    const cameraLook = new THREE.Vector3(0, 0, 0)
    const scratchForward = new THREE.Vector3(0, 0, 0)
    const scratchDesired = new THREE.Vector3(0, 0, 0)

    const integrateSpine = (headPos: THREE.Vector3, desiredLength: number) => {
      const spine = spineRef.current
      if (spine.length === 0) {
        spine.push(headPos.clone())
        return
      }

      const last = spine[0]
      if (last.distanceTo(headPos) > 0.01) {
        spine.unshift(headPos.clone())
      } else {
        spine[0].copy(headPos)
      }

      let remaining = desiredLength
      for (let i = 0; i < spine.length - 1; i += 1) {
        const a = spine[i]
        const b = spine[i + 1]
        const segLen = a.distanceTo(b)
        if (segLen <= remaining) {
          remaining -= segLen
          continue
        }
        const t = segLen === 0 ? 0 : remaining / segLen
        const cut = a.clone().lerp(b, t)
        spine[i + 1].copy(cut)
        spine.length = i + 2
        return
      }
    }

    const sampleAlongSpine = (spine: THREE.Vector3[], distanceFromHead: number): THREE.Vector3 => {
      if (spine.length === 0) return new THREE.Vector3(0, 0, 0)
      let remaining = distanceFromHead
      for (let i = 0; i < spine.length - 1; i += 1) {
        const a = spine[i]
        const b = spine[i + 1]
        const segLen = a.distanceTo(b)
        if (segLen <= remaining) {
          remaining -= segLen
          continue
        }
        const t = segLen === 0 ? 0 : remaining / segLen
        return a.clone().lerp(b, t)
      }
      return spine[spine.length - 1].clone()
    }

    const renderSnake = (dt: number) => {
      const desiredLength = BASE_LENGTH + scoreRef.current * LENGTH_PER_SCORE
      const spine = spineRef.current

      const headPos = headPosRef.current
      const headPosWrapped = wrapVectorXZ(headPos)
      const shiftX = headPos.x - headPosWrapped.x
      const shiftZ = headPos.z - headPosWrapped.z
      const deltaShiftX = shiftX - headWrapShiftRef.current.x
      const deltaShiftZ = shiftZ - headWrapShiftRef.current.z
      if (deltaShiftX !== 0 || deltaShiftZ !== 0) {
        cameraPos.x -= deltaShiftX
        cameraPos.z -= deltaShiftZ
        headWrapShiftRef.current = { x: shiftX, z: shiftZ }
      }
      const headYaw = yawRef.current

      headMesh.position.set(headPosWrapped.x, 0.72, headPosWrapped.z)
      headMesh.rotation.y = headYaw

      const foodPos = foodPosRef.current
      foodMesh.position.set(foodPos.x, 0.35, foodPos.z)

      // Body only (head is separate mesh)
      const maxSegments = Math.min(Math.floor(desiredLength / SEGMENT_SPACING) + 1, maxInstances)
      for (let i = 1; i < maxSegments; i += 1) {
        const d = i * SEGMENT_SPACING
        const p = sampleAlongSpine(spine, d)
        const pw = wrapVectorXZ(p)
        dummy.position.set(pw.x, 0.5, pw.z)
        dummy.rotation.y = headYaw

        const t = i / Math.max(maxSegments - 1, 1)
        const scale = 1.1 - 0.35 * t
        dummy.scale.set(scale, scale, scale)

        dummy.updateMatrix()
        snakeMesh.setMatrixAt(i - 1, dummy.matrix)
      }

      snakeMesh.count = Math.max(maxSegments - 1, 0)
      snakeMesh.instanceMatrix.needsUpdate = true

      // Camera follow
      scratchForward.copy(forwardFromYaw(headYaw))
      const isHeadCam = cameraModeRef.current === 'head'
      const followDistance = isHeadCam ? 2.2 : 6.8
      const height = isHeadCam ? 1.9 : 3.2
      const lookAhead = isHeadCam ? 8.0 : 3.8

      const desiredWrapped = scratchDesired
        .copy(headPosWrapped)
        .sub(scratchForward.clone().multiplyScalar(followDistance))
        .add(new THREE.Vector3(0, height, 0))

      const desired = wrapVectorXZToNearest(desiredWrapped, cameraPos)

      const a = smoothAlpha(dt, isHeadCam ? 32 : 22)
      cameraPos.lerp(desired, a)
      camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z)

      headMesh.visible = true
      headMesh.scale.set(isHeadCam ? 0.28 : 1, isHeadCam ? 0.28 : 1, isHeadCam ? 0.28 : 1)

      const lookWrapped = cameraLook
        .copy(headPosWrapped)
        .add(scratchForward.multiplyScalar(lookAhead))
        .add(new THREE.Vector3(0, 0.8, 0))

      const look = wrapVectorXZToNearest(lookWrapped, desired)
      camera.lookAt(look)
    }

    const step = (dt: number) => {
      if (isPausedRef.current || isGameOverRef.current) return

      const controls = controlsRef.current
      const steer =
        ((controls.keySteerRight ? 1 : 0) - (controls.keySteerLeft ? 1 : 0)) + controls.touchSteerAxis

      const speedAxis =
        ((controls.keyFaster ? -1 : 0) + (controls.keySlower ? 1 : 0)) + controls.touchSpeedAxis
      const speedBoost = clamp(-speedAxis, -1, 1)
      const speed = BASE_SPEED * (1 + 0.35 * speedBoost)

      yawRef.current += clamp(steer, -1, 1) * TURN_SPEED * steerSensitivityRef.current * dt

      const headPos = headPosRef.current
      const forward = forwardFromYaw(yawRef.current)
      headPos.add(forward.multiplyScalar(speed * dt))

      if (isWallWrapEnabledRef.current) {
        const wrappedX = wrapCoord(headPos.x)
        const wrappedZ = wrapCoord(headPos.z)
        const shiftX = headPos.x - wrappedX
        const shiftZ = headPos.z - wrappedZ
        if (shiftX !== 0 || shiftZ !== 0) {
          headPos.x = wrappedX
          headPos.z = wrappedZ

          const spine = spineRef.current
          for (let i = 0; i < spine.length; i += 1) {
            spine[i].x -= shiftX
            spine[i].z -= shiftZ
          }

          cameraPos.x -= shiftX
          cameraPos.z -= shiftZ
        }
      } else {
        const half = HALF_ARENA - 0.6
        if (Math.abs(headPos.x) > half || Math.abs(headPos.z) > half) {
          setIsGameOver(true)
          vibrate([60, 40, 80])
          return
        }
      }

      const desiredLength = BASE_LENGTH + scoreRef.current * LENGTH_PER_SCORE
      integrateSpine(headPos, desiredLength)

      const foodDist = isWallWrapEnabledRef.current
        ? torusDistanceXZ(headPos, foodPosRef.current)
        : headPos.distanceTo(foodPosRef.current)
      if (foodDist < HEAD_RADIUS + FOOD_RADIUS) {
        setScore((s) => {
          scoreRef.current = s + 1
          return s + 1
        })
        foodPosRef.current = randomFoodPosition(rng)
        vibrate(16)
      }

      const spine = spineRef.current
      for (let i = 18; i < spine.length; i += 1) {
        const hitDist = isWallWrapEnabledRef.current ? torusDistanceXZ(headPos, spine[i]) : headPos.distanceTo(spine[i])
        if (hitDist < 0.72) {
          setIsGameOver(true)
          vibrate([60, 40, 80])
          return
        }
      }
    }

    let rafId = 0
    let lastTimeMs = performance.now()
    const animate = (timeMs: number) => {
      rafId = window.requestAnimationFrame(animate)
      const dt = Math.min((timeMs - lastTimeMs) / 1000, 0.2)
      lastTimeMs = timeMs
      step(dt)
      renderSnake(dt)
      const showWalls = !isWallWrapEnabledRef.current
      for (let i = 0; i < walls.length; i += 1) walls[i].visible = showWalls
      renderer.render(scene, camera)
    }
    rafId = window.requestAnimationFrame(animate)

    return () => {
      resetGameRef.current = null
      window.cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      container.removeChild(renderer.domElement)

      snakeMesh.geometry.dispose()
      ;(snakeMesh.material as THREE.Material).dispose()
      foodGeom.dispose()
      foodMat.dispose()
      headGeom.dispose()
      headMat.dispose()
      floorGeom.dispose()
      floorMat.dispose()
      wallGeomX.dispose()
      wallGeomZ.dispose()
      wallMat.dispose()
      renderer.dispose()
    }
  }, [rng, vibrate])

  const isOverlayOpen = isPaused || isGameOver

  return (
    <div className="snakeGame">
      <div className="snakeGameCanvas" ref={containerRef} />

      <div className="snakeHud" aria-live="polite">
        <div className="snakeHudRow snakeHudRowTop">
          <span className="snakeHudLabel">Score</span>
          <span className="snakeHudValue">{score}</span>
          <span className="snakeHudLabel" style={{ marginLeft: 12 }}>
            Best
          </span>
          <span className="snakeHudValue">{bestScore}</span>
          <span className="snakeHudSpacer" />
          <button
            type="button"
            className="snakeHudButton"
            onClick={() => {
              setIsSettingsOpen(true)
              vibrate(8)
            }}
          >
            Settings
          </button>
        </div>
        <div className="snakeHudRow">
          <span className="snakeHudHint">
            {showTouchControls
              ? 'Touch: joystick · Pause/Cam/Settings · Restart on Game Over'
              : 'Steer: A/D or ←/→ · Speed: W/S or ↑/↓ · Cam: C · Pause: Space · Restart: R'}
          </span>
        </div>
      </div>

      {showTouchControls && (
        <div className="snakeTouchControls" aria-hidden="true">
          <div
            className="snakeJoystick"
            onPointerDown={(e) => {
              if (joystickPointerIdRef.current !== null) return
              joystickPointerIdRef.current = e.pointerId
              joystickActiveRef.current = true
              ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!joystickActiveRef.current) return
              if (joystickPointerIdRef.current !== e.pointerId) return

              const el = e.currentTarget as HTMLDivElement
              const rect = el.getBoundingClientRect()
              const cx = rect.left + rect.width / 2
              const cy = rect.top + rect.height / 2
              const dx = e.clientX - cx
              const dy = e.clientY - cy
              const radius = rect.width * 0.35
              const len = Math.sqrt(dx * dx + dy * dy)
              const k = len > radius && len > 0 ? radius / len : 1
              const ndx = (dx * k) / radius
              const ndy = (dy * k) / radius

              setJoystickKnob({ x: ndx, y: ndy })

              const deadzone = 0.12
              const applyCurve = (v: number) => {
                const a = Math.abs(v)
                if (a < deadzone) return 0
                const t = (a - deadzone) / (1 - deadzone)
                const curved = Math.pow(t, 1.25)
                return Math.sign(v) * curved
              }

              controlsRef.current.touchSteerAxis = clamp(applyCurve(ndx), -1, 1)
              controlsRef.current.touchSpeedAxis = clamp(applyCurve(ndy), -1, 1)
            }}
            onPointerUp={(e) => {
              if (joystickPointerIdRef.current !== e.pointerId) return
              joystickPointerIdRef.current = null
              joystickActiveRef.current = false
              setJoystickKnob({ x: 0, y: 0 })
              controlsRef.current.touchSteerAxis = 0
              controlsRef.current.touchSpeedAxis = 0
            }}
            onPointerCancel={(e) => {
              if (joystickPointerIdRef.current !== e.pointerId) return
              joystickPointerIdRef.current = null
              joystickActiveRef.current = false
              setJoystickKnob({ x: 0, y: 0 })
              controlsRef.current.touchSteerAxis = 0
              controlsRef.current.touchSpeedAxis = 0
            }}
          >
            <div className="snakeJoystickBase" />
            <div
              className="snakeJoystickKnob"
              style={{
                transform: `translate(calc(-50% + ${joystickKnob.x * 28}px), calc(-50% + ${joystickKnob.y * 28}px))`,
              }}
            />
          </div>

          <div className="snakeTouchButtons">
            <button
              type="button"
              className="snakeTouchButton"
              onClick={() => {
                setIsPaused((p) => !p)
                vibrate(8)
              }}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="snakeTouchButton"
              onClick={() => {
                setCameraMode((m) => (m === 'head' ? 'chase' : 'head'))
                vibrate(8)
              }}
            >
              Cam
            </button>
            <button
              type="button"
              className="snakeTouchButton"
              onClick={() => {
                setIsSettingsOpen((v) => !v)
                vibrate(8)
              }}
            >
              Settings
            </button>
            {isOverlayOpen && (
              <button
                type="button"
                className="snakeTouchButton"
                onClick={() => {
                  resetGameRef.current?.()
                }}
              >
                Restart
              </button>
            )}
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="snakeSettings" role="dialog" aria-modal="false" aria-label="Settings">
          <div className="snakeSettingsTitle">Controls</div>
          <label className="snakeSettingsRow">
            <span className="snakeSettingsLabel">Walls wrap</span>
            <input
              type="checkbox"
              checked={isWallWrapEnabled}
              onChange={(e) => {
                setIsWallWrapEnabled(e.target.checked)
                vibrate(8)
              }}
            />
          </label>
          <label className="snakeSettingsRow">
            <span className="snakeSettingsLabel">Steering sensitivity</span>
            <input
              className="snakeSettingsRange"
              type="range"
              min={0.6}
              max={1.8}
              step={0.05}
              value={steerSensitivity}
              onChange={(e) => setSteerSensitivity(Number(e.target.value))}
            />
          </label>
          <label className="snakeSettingsRow">
            <span className="snakeSettingsLabel">Haptics</span>
            <input
              type="checkbox"
              checked={isHapticsEnabled}
              onChange={(e) => {
                setIsHapticsEnabled(e.target.checked)
                if (e.target.checked) setTimeout(() => vibrate(10), 0)
              }}
            />
          </label>
          <div className="snakeSettingsFooter">
            <button type="button" onClick={() => setIsSettingsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {isOverlayOpen && (
        <div className="snakeOverlay" role="dialog" aria-modal="true">
          <div className="snakeOverlayCard">
            <div className="snakeOverlayTitle">{isGameOver ? 'Game Over' : 'Paused'}</div>
            <div className="snakeOverlayText">Score: {score}</div>
            <div className="snakeOverlayText">
              Best: {bestScore}
              {isGameOver && score > 0 && score === bestScore ? ' (New!)' : ''}
            </div>
            <div className="snakeOverlayActions">
              <button
                type="button"
                onClick={() => {
                  if (isGameOver) {
                    resetGameRef.current?.()
                    return
                  }
                  setIsPaused(false)
                }}
              >
                {isGameOver ? 'Restart (R)' : 'Resume (Space)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


