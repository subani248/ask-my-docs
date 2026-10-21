import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

function createGlowSprite(
  color: THREE.Color,
  size: number,
  opacity: number,
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  const { r, g, b } = {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
  }
  gradient.addColorStop(0, `rgba(${r},${g},${b},${opacity})`)
  gradient.addColorStop(0.4, `rgba(${r},${g},${b},${opacity * 0.4})`)
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(size, size, 1)
  return sprite
}

function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(200,180,255,0.8)')
  gradient.addColorStop(0.5, 'rgba(140,100,255,0.3)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

interface FloatingIcon {
  group: THREE.Group
  baseY: number
  baseX: number
  phase: number
  speed: number
  rotSpeed: number
}

export default function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)

  const init = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0b0a1a, 0.015)

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 4, 14)
    camera.lookAt(0, 1.5, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    // Colors
    const purpleColor = new THREE.Color(0x9333ea)
    const blueColor = new THREE.Color(0x3b82f6)
    const pinkColor = new THREE.Color(0xd946ef)
    const cyanColor = new THREE.Color(0x06b6d4)

    // === LIGHTING ===
    const ambientLight = new THREE.AmbientLight(0x1a1030, 0.6)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0x9333ea, 2.0)
    mainLight.position.set(5, 8, 5)
    scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight(0x3b82f6, 1.0)
    fillLight.position.set(-5, 3, 2)
    scene.add(fillLight)

    const rimLight = new THREE.PointLight(0xd946ef, 3, 20)
    rimLight.position.set(0, 5, -3)
    scene.add(rimLight)

    const bottomGlow = new THREE.PointLight(0x9333ea, 4, 15)
    bottomGlow.position.set(0, -1, 5)
    scene.add(bottomGlow)

    // === GLOSSY PLATFORM ===
    // Main platform - rounded rectangle feel
    const platformGeom = new THREE.CylinderGeometry(8, 8.5, 0.6, 64, 1)
    const platformMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f0d2a,
      metalness: 0.9,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.0,
      reflectivity: 1.0,
    })
    const platform = new THREE.Mesh(platformGeom, platformMat)
    platform.position.y = -1.5
    platform.receiveShadow = true
    scene.add(platform)

    // Platform edge glow ring
    const ringGeom = new THREE.TorusGeometry(8.2, 0.08, 16, 128)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.9,
    })
    const ring = new THREE.Mesh(ringGeom, ringMat)
    ring.position.y = -1.2
    ring.rotation.x = Math.PI / 2
    scene.add(ring)

    // Inner glow ring
    const innerRingGeom = new THREE.TorusGeometry(6, 0.04, 16, 128)
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.5,
    })
    const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat)
    innerRing.position.y = -1.2
    innerRing.rotation.x = Math.PI / 2
    scene.add(innerRing)

    // Platform glow sprites
    const platformGlow = createGlowSprite(purpleColor, 20, 0.25)
    platformGlow.position.set(0, -1.8, 0)
    scene.add(platformGlow)

    const edgeGlow1 = createGlowSprite(blueColor, 8, 0.4)
    edgeGlow1.position.set(6, -1.2, 2)
    scene.add(edgeGlow1)

    const edgeGlow2 = createGlowSprite(purpleColor, 10, 0.35)
    edgeGlow2.position.set(-5, -1.2, 3)
    scene.add(edgeGlow2)

    // === GLASS PANEL (right side - chat mockup) ===
    const panelGroup = new THREE.Group()
    panelGroup.position.set(4, 2.5, -1)
    panelGroup.rotation.y = -0.15
    scene.add(panelGroup)

    // Panel body
    const panelGeom = new THREE.BoxGeometry(4.5, 5.5, 0.12)
    const panelMat = new THREE.MeshPhysicalMaterial({
      color: 0x13122a,
      metalness: 0.3,
      roughness: 0.15,
      transparent: true,
      opacity: 0.75,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    })
    const panel = new THREE.Mesh(panelGeom, panelMat)
    panelGroup.add(panel)

    // Panel border glow
    const panelEdgeGeom = new THREE.EdgesGeometry(panelGeom)
    const panelEdgeMat = new THREE.LineBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.6,
    })
    const panelEdges = new THREE.LineSegments(panelEdgeGeom, panelEdgeMat)
    panelGroup.add(panelEdges)

    // Panel glow aura
    const panelGlow = createGlowSprite(purpleColor, 10, 0.2)
    panelGlow.position.set(0, 0, 0.5)
    panelGroup.add(panelGlow)

    // === LEFT SIDE PANEL ===
    const leftPanelGroup = new THREE.Group()
    leftPanelGroup.position.set(-3, 2, 0.5)
    leftPanelGroup.rotation.y = 0.2
    scene.add(leftPanelGroup)

    const leftPanelGeom = new THREE.BoxGeometry(3.5, 4, 0.1)
    const leftPanelMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f0d2a,
      metalness: 0.4,
      roughness: 0.2,
      transparent: true,
      opacity: 0.5,
      clearcoat: 0.6,
    })
    const leftPanel = new THREE.Mesh(leftPanelGeom, leftPanelMat)
    leftPanelGroup.add(leftPanel)

    const leftPanelEdgeGeom = new THREE.EdgesGeometry(leftPanelGeom)
    const leftPanelEdgeMat = new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.4,
    })
    leftPanelGroup.add(new THREE.LineSegments(leftPanelEdgeGeom, leftPanelEdgeMat))

    // === FLOATING 3D ICONS ===
    const floatingIcons: FloatingIcon[] = []

    const iconConfigs = [
      { pos: [-1.5, 4, 1], size: 0.45, color: purpleColor, phase: 0 },
      { pos: [-2.5, 3, 2], size: 0.4, color: blueColor, phase: 1.2 },
      { pos: [-1, 5.5, 0.5], size: 0.35, color: pinkColor, phase: 2.4 },
      { pos: [-3, 5, 1.5], size: 0.3, color: cyanColor, phase: 3.6 },
      { pos: [-2, 6.5, 0], size: 0.38, color: purpleColor, phase: 4.8 },
      { pos: [6.5, 1, 1], size: 0.5, color: pinkColor, phase: 0.8 },
      { pos: [7, 3.5, 0.5], size: 0.35, color: cyanColor, phase: 2.0 },
      { pos: [5.5, 5, 1], size: 0.4, color: purpleColor, phase: 3.2 },
    ]

    iconConfigs.forEach((cfg) => {
      const group = new THREE.Group()
      group.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])

      // Icon box
      const boxGeom = new THREE.BoxGeometry(cfg.size, cfg.size, cfg.size * 0.5)
      const boxMat = new THREE.MeshPhysicalMaterial({
        color: cfg.color,
        metalness: 0.6,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        emissive: cfg.color,
        emissiveIntensity: 0.3,
      })
      const box = new THREE.Mesh(boxGeom, boxMat)
      group.add(box)

      // Icon glow
      const glow = createGlowSprite(cfg.color, cfg.size * 3, 0.3)
      glow.position.set(0, 0, 0.3)
      group.add(glow)

      // Small point light on each icon
      const iconLight = new THREE.PointLight(cfg.color.getHex(), 0.5, 4)
      iconLight.position.set(0, 0, 0.5)
      group.add(iconLight)

      scene.add(group)
      floatingIcons.push({
        group,
        baseY: cfg.pos[1],
        baseX: cfg.pos[0],
        phase: cfg.phase,
        speed: 0.3 + Math.random() * 0.3,
        rotSpeed: 0.2 + Math.random() * 0.4,
      })
    })

    // === FLOATING LINES / CONNECTIONS ===
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.15,
    })

    for (let i = 0; i < 6; i++) {
      const points: THREE.Vector3[] = []
      const startAngle = (i / 6) * Math.PI * 2
      const endAngle = startAngle + (Math.random() - 0.5) * 1.5
      points.push(
        new THREE.Vector3(
          Math.cos(startAngle) * 7,
          Math.random() * 3 + 1,
          Math.sin(startAngle) * 3,
        ),
      )
      points.push(
        new THREE.Vector3(
          Math.cos(endAngle) * 4,
          Math.random() * 4 + 2,
          Math.sin(endAngle) * 2,
        ),
      )
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points)
      scene.add(new THREE.Line(lineGeom, lineMat))
    }

    // === PARTICLES ===
    const particleCount = 300
    const particlePositions = new Float32Array(particleCount * 3)
    const particleSizes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 30
      particlePositions[i * 3 + 1] = Math.random() * 15 - 2
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 20
      particleSizes[i] = Math.random() * 3 + 0.5
    }

    const particleGeom = new THREE.BufferGeometry()
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    particleGeom.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1))

    const particleTexture = createParticleTexture()
    const particleMat = new THREE.PointsMaterial({
      size: 0.15,
      map: particleTexture,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xb090ff,
    })

    const particles = new THREE.Points(particleGeom, particleMat)
    scene.add(particles)

    // === STAR SPRITES (background depth) ===
    for (let i = 0; i < 40; i++) {
      const star = createGlowSprite(
        new THREE.Color().setHSL(0.7 + Math.random() * 0.15, 0.6, 0.7),
        0.5 + Math.random() * 1.5,
        0.3 + Math.random() * 0.4,
      )
      star.position.set(
        (Math.random() - 0.5) * 30,
        Math.random() * 12 - 2,
        -8 - Math.random() * 10,
      )
      scene.add(star)
    }

    // === GROUND REFLECTION PLANE ===
    const groundGeom = new THREE.PlaneGeometry(50, 50)
    const groundMat = new THREE.MeshPhysicalMaterial({
      color: 0x080618,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.6,
    })
    const ground = new THREE.Mesh(groundGeom, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.8
    scene.add(ground)

    // === ANIMATION LOOP ===
    const clock = new THREE.Clock()

    const animate = () => {
      const elapsed = clock.getElapsedTime()

      // Gentle camera sway
      camera.position.x = Math.sin(elapsed * 0.15) * 0.8
      camera.position.y = 4 + Math.sin(elapsed * 0.2) * 0.3
      camera.lookAt(0, 1.5, 0)

      // Animate floating icons
      floatingIcons.forEach((icon) => {
        icon.group.position.y =
          icon.baseY + Math.sin(elapsed * icon.speed + icon.phase) * 0.4
        icon.group.position.x =
          icon.baseX + Math.sin(elapsed * icon.speed * 0.7 + icon.phase) * 0.2
        icon.group.rotation.y = elapsed * icon.rotSpeed
        icon.group.rotation.x = Math.sin(elapsed * 0.5 + icon.phase) * 0.15
      })

      // Animate particles
      const posAttr = particleGeom.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < particleCount; i++) {
        posAttr.array[i * 3 + 1] += Math.sin(elapsed * 0.5 + i) * 0.001
        posAttr.array[i * 3] += Math.cos(elapsed * 0.3 + i * 0.5) * 0.0005
      }
      posAttr.needsUpdate = true

      // Pulse rings
      ring.material.opacity = 0.6 + Math.sin(elapsed * 1.5) * 0.3
      innerRing.material.opacity = 0.3 + Math.sin(elapsed * 2 + 1) * 0.2

      // Pulse panel edge glow
      panelEdgeMat.opacity = 0.4 + Math.sin(elapsed * 1.2) * 0.2

      // Gentle platform rotation
      platform.rotation.y = elapsed * 0.05

      // Pulse bottom glow
      bottomGlow.intensity = 3 + Math.sin(elapsed * 1.8) * 1.5

      renderer.render(scene, camera)
      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)

    // === RESIZE ===
    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameRef.current)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    const cleanup = init()
    return () => {
      cleanup?.()
    }
  }, [init])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0"
      style={{ overflow: 'hidden' }}
    />
  )
}
