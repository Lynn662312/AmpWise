import { useEffect, useRef, useState, type RefObject } from "react"

type CountUpOptions = {
  duration?: number
  delay?: number
  animateOnView?: boolean
}

type CountUpResult = {
  value: number
  ref: RefObject<HTMLElement | null>
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function useCountUp(target: number, { duration = 1000, delay = 0, animateOnView = true }: CountUpOptions = {}): CountUpResult {
  const safeTarget = Number.isFinite(target) ? target : 0
  const [displayed, setDisplayed] = useState(animateOnView ? 0 : safeTarget)
  const [visible, setVisible] = useState(!animateOnView)
  const ref = useRef<HTMLElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const displayedRef = useRef(displayed)
  const hasAnimatedRef = useRef(!animateOnView)
  const targetRef = useRef(safeTarget)

  useEffect(() => {
    if (!animateOnView || typeof window === "undefined") return
    const element = ref.current
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true) }, { threshold: 0.12 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [animateOnView])

  useEffect(() => {
    if (!visible || !Number.isFinite(target)) return
    if (targetRef.current === safeTarget && hasAnimatedRef.current) return
    targetRef.current = safeTarget
    if (prefersReducedMotion()) {
      displayedRef.current = safeTarget
      setDisplayed(safeTarget)
      hasAnimatedRef.current = true
      return
    }

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    const startValue = hasAnimatedRef.current ? displayedRef.current : 0
    const startedAt = performance.now() + Math.max(0, delay)
    const tick = (now: number) => {
      if (now < startedAt) {
        frameRef.current = requestAnimationFrame(tick)
        return
      }
      const progress = Math.min(1, (now - startedAt) / Math.max(1, duration))
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValue = startValue + (safeTarget - startValue) * eased
      displayedRef.current = nextValue
      setDisplayed(nextValue)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else {
        displayedRef.current = safeTarget
        setDisplayed(safeTarget)
        hasAnimatedRef.current = true
        frameRef.current = null
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [delay, duration, safeTarget, target, visible])

  return { value: displayed, ref }
}
