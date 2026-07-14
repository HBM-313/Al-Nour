/**
 * Nouri — 3D-lysånd-følgesvend (Three.js).
 *
 * Design-beslutning: følgesvenden er en LYSÅND — en lille glødende lanterne-
 * ånd med øjne — ikke et 3D-barn. Det er bevidst: (a) lys er platformens
 * kernemetafor, (b) primitiv-byggede menneskefigurer bliver uhyggelige,
 * (c) en lysånd kan aldrig forveksles med afbildning af de hellige
 * (lys-normen respekteres — Nouri er en fantasi-lanterneånd, et VÆSEN af
 * lys, ikke en repræsentation af nogen).
 *
 * Tilstande: idle (svæver roligt) → cheer (hopper begejstret ved fremskridt)
 * → celebrate (spinner + gnist-udbrud når bogstavet tændes).
 *
 * Lazy-loades (React.lazy) så three.js ikke lander i hoved-bundlen.
 * Respekterer prefers-reduced-motion. Falder pænt tilbage hvis WebGL mangler.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type CompanionMood = "idle" | "cheer" | "celebrate";

export default function NourCompanion({
  mood,
  pulse = 0,
  size = 120,
}: {
  mood: CompanionMood;
  /** Tæller — hvert hop retrigger reaktionen selv om mood er uændret */
  pulse?: number;
  size?: number;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const moodRef = useRef<CompanionMood>(mood);
  moodRef.current = mood;
  // Tidsstempel for seneste mood-skifte — driver de korte reaktioner
  const moodChangedAtRef = useRef(performance.now());

  useEffect(() => {
    moodChangedAtRef.current = performance.now();
  }, [mood, pulse]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      // Ingen WebGL: en blød CSS-glød som fallback
      mount.innerHTML = "";
      const dot = document.createElement("div");
      dot.style.cssText = `width:${size * 0.5}px;height:${size * 0.5}px;border-radius:9999px;background:radial-gradient(circle,#ffd98a 0%,#f0b429 60%,transparent 75%);margin:${size * 0.25}px auto;`;
      mount.appendChild(dot);
      return () => {
        mount.innerHTML = "";
      };
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0.15, 4.4);

    // ------------------------------------------------------------------------
    // Nouri: kerne af lys + glas-skal + ansigt + svævende ring + gnister
    // ------------------------------------------------------------------------
    const nouri = new THREE.Group();
    scene.add(nouri);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffd98a,
        emissive: 0xf0b429,
        emissiveIntensity: 1.6,
        roughness: 0.35,
      }),
    );
    nouri.add(core);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 32, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xfff4dc,
        transparent: true,
        opacity: 0.18,
        roughness: 0.1,
        metalness: 0,
      }),
    );
    nouri.add(shell);

    // Ansigt: to øjne + lille smil — placeret på kernens forside
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1d2b50 });
    const eyeGeo = new THREE.SphereGeometry(0.075, 16, 16);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, 0.12, 0.56);
    eyeR.position.set(0.2, 0.12, 0.56);
    nouri.add(eyeL, eyeR);

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.035, 12, 24, Math.PI * 0.75),
      eyeMat,
    );
    smile.position.set(0, -0.06, 0.56);
    smile.rotation.z = Math.PI + Math.PI * 0.125;
    nouri.add(smile);

    // Svævende ring — lanterne-antydning
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.04, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0xf0b429,
        emissive: 0xf0b429,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      }),
    );
    ring.rotation.x = Math.PI / 2.4;
    nouri.add(ring);

    // Kredsende gnister
    const SPARK_COUNT = reducedMotion ? 0 : 14;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(SPARK_COUNT * 3);
    const sparkSeed: number[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      sparkSeed.push(Math.random() * Math.PI * 2, 0.9 + Math.random() * 0.5);
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({
        color: 0xffd98a,
        size: 0.07,
        transparent: true,
        opacity: 0.9,
      }),
    );
    nouri.add(sparks);

    // Lys
    scene.add(new THREE.AmbientLight(0xfdf8ee, 0.7));
    const glow = new THREE.PointLight(0xf0b429, 14, 8);
    glow.position.set(0, 0.2, 1.2);
    scene.add(glow);

    // ------------------------------------------------------------------------
    // Animation
    // ------------------------------------------------------------------------
    let raf = 0;
    const clock = new THREE.Clock();

    function animate() {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const mood = moodRef.current;
      const sinceMood = (performance.now() - moodChangedAtRef.current) / 1000;

      if (reducedMotion) {
        // Rolig, næsten stille tilstedeværelse
        nouri.position.y = 0;
        nouri.rotation.set(0, 0, 0);
      } else if (mood === "celebrate") {
        // Jubel: spin + hop + pulserende glød (klinger af over ~2.5 sek)
        const k = Math.max(0, 1 - sinceMood / 2.5);
        nouri.rotation.y = t * (2 + 6 * k);
        nouri.position.y = Math.abs(Math.sin(t * 6)) * 0.35 * k + Math.sin(t * 1.4) * 0.08;
        const pulse = 1 + Math.sin(t * 10) * 0.12 * k;
        nouri.scale.setScalar(pulse);
        glow.intensity = 14 + 22 * k;
      } else if (mood === "cheer") {
        // Hep: begejstret vip + lille hop (klinger af over ~1 sek)
        const k = Math.max(0, 1 - sinceMood / 1);
        nouri.rotation.y = Math.sin(t * 4) * 0.25;
        nouri.rotation.z = Math.sin(t * 8) * 0.12 * k;
        nouri.position.y = Math.abs(Math.sin(t * 5)) * 0.18 * k + Math.sin(t * 1.4) * 0.08;
        nouri.scale.setScalar(1 + 0.05 * k);
        glow.intensity = 14 + 8 * k;
      } else {
        // Idle: blidt svæv, langsom nysgerrig drejning, ring der vipper
        nouri.rotation.y = Math.sin(t * 0.5) * 0.35;
        nouri.rotation.z = 0;
        nouri.position.y = Math.sin(t * 1.4) * 0.09;
        nouri.scale.setScalar(1);
        glow.intensity = 14 + Math.sin(t * 2.2) * 2;
      }

      ring.rotation.z = t * 0.6;

      // Gnister i bane omkring Nouri
      const pos = sparkGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < SPARK_COUNT; i++) {
        const phase = sparkSeed[i * 2];
        const radius = sparkSeed[i * 2 + 1];
        const speed = mood === "celebrate" ? 2.6 : 0.9;
        const a = phase + t * speed;
        pos.setXYZ(
          i,
          Math.cos(a) * radius,
          Math.sin(a * 1.7 + phase) * 0.5,
          Math.sin(a) * radius * 0.6,
        );
      }
      pos.needsUpdate = true;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      mount.innerHTML = "";
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      aria-hidden
      className="pointer-events-none"
    />
  );
}
