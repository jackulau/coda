import { describe, expect, test } from "bun:test"
import {
  BoundedLoafBuffer,
  breakdownNavigation,
  computeCls,
  computeInp,
  isFromCache,
  pickFcp,
  sortResourceWaterfall,
} from "./performance"

describe("computeCls", () => {
  test("empty → 0", () => {
    expect(computeCls([])).toBe(0)
  })

  test("sums within 1s gap", () => {
    const shifts = [
      { value: 0.1, startTime: 0, hadRecentInput: false },
      { value: 0.1, startTime: 500, hadRecentInput: false },
    ]
    expect(computeCls(shifts)).toBeCloseTo(0.2, 3)
  })

  test("resets after 1 s gap", () => {
    const shifts = [
      { value: 0.1, startTime: 0, hadRecentInput: false },
      { value: 0.2, startTime: 1500, hadRecentInput: false },
    ]
    expect(computeCls(shifts)).toBeCloseTo(0.2, 3)
  })

  test("resets after 5 s total session", () => {
    const shifts = [
      { value: 0.1, startTime: 0, hadRecentInput: false },
      { value: 0.1, startTime: 4800, hadRecentInput: false },
      { value: 0.1, startTime: 5001, hadRecentInput: false },
    ]
    expect(computeCls(shifts)).toBeCloseTo(0.2, 3)
  })

  test("user-input shifts ignored", () => {
    const shifts = [
      { value: 1.0, startTime: 0, hadRecentInput: true },
      { value: 0.1, startTime: 500, hadRecentInput: false },
    ]
    expect(computeCls(shifts)).toBeCloseTo(0.1, 3)
  })
})

describe("computeInp", () => {
  test("empty → 0", () => {
    expect(computeInp([])).toBe(0)
  })

  test("p98 of 100-value sample", () => {
    const ds = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(computeInp(ds)).toBe(98)
  })
})

describe("pickFcp", () => {
  test("returns first-contentful-paint startTime when present", () => {
    expect(
      pickFcp([
        { name: "first-paint", startTime: 100 },
        { name: "first-contentful-paint", startTime: 200 },
      ]),
    ).toBe(200)
  })
  test("returns undefined when absent", () => {
    expect(pickFcp([{ name: "first-paint", startTime: 100 }])).toBeUndefined()
  })
})

describe("breakdownNavigation", () => {
  test("computes DNS/TCP/TLS/TTFB/download/domEvents", () => {
    const s = breakdownNavigation({
      domainLookupStart: 0,
      domainLookupEnd: 10,
      connectStart: 10,
      connectEnd: 50,
      secureConnectionStart: 20,
      requestStart: 50,
      responseStart: 100,
      responseEnd: 200,
      domContentLoadedEventEnd: 250,
      loadEventEnd: 300,
    })
    expect(s).toEqual({
      dns: 10,
      tcp: 40,
      tls: 30,
      ttfb: 50,
      download: 100,
      domEvents: 50,
    })
  })
})

describe("BoundedLoafBuffer", () => {
  test("cap evicts oldest", () => {
    const b = new BoundedLoafBuffer(2)
    b.add({ startTime: 1, duration: 100 })
    b.add({ startTime: 2, duration: 120 })
    b.add({ startTime: 3, duration: 50 })
    expect(b.size()).toBe(2)
    expect(b.list()[0]?.startTime).toBe(2)
  })
})

describe("resource helpers", () => {
  test("isFromCache when transferSize=0 but body present", () => {
    expect(isFromCache({ startTime: 0, transferSize: 0, encodedBodySize: 512 })).toBe(true)
    expect(isFromCache({ startTime: 0, transferSize: 1, encodedBodySize: 512 })).toBe(false)
  })

  test("sortResourceWaterfall sorts by startTime", () => {
    const r = sortResourceWaterfall([
      { startTime: 10, transferSize: 1, encodedBodySize: 1 },
      { startTime: 0, transferSize: 1, encodedBodySize: 1 },
    ])
    expect(r.map((x) => x.startTime)).toEqual([0, 10])
  })
})
