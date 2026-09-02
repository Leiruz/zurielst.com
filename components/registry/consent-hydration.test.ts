import {
  createConsentManagerStore,
  type ConsentManagerInterface,
  type ConsentState,
} from "c15t"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  restorePersistedConsent,
  type PersistedConsent,
} from "./consent-hydration"
import { syncCloudflareWebAnalytics } from "./cloudflare-web-analytics"

type FakeScript = {
  defer: boolean
  parentNode: FakeHead | null
  src: string
  attributes: Map<string, string>
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
}

type FakeHead = {
  scripts: FakeScript[]
  appendChild: (script: FakeScript) => FakeScript
  removeChild: (script: FakeScript) => FakeScript
}

const storedConsents = {
  experience: false,
  functionality: false,
  marketing: false,
  measurement: true,
  necessary: true,
} satisfies ConsentState

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("persisted consent hydration", () => {
  it("updates a fresh live store and injects one beacon without a banner action", async () => {
    const manager = createManagerHarness()
    const store = createConsentManagerStore(manager, {
      initialGdprTypes: ["necessary", "measurement"],
    })
    const { document, head } = createDocumentHarness()
    vi.stubGlobal("window", { location: { hostname: "zurielst.com" } })

    syncCloudflareWebAnalytics({
      document,
      measurementGranted: store.getState().consents.measurement,
    })
    const unsubscribe = store.subscribe((state) => {
      syncCloudflareWebAnalytics({
        document,
        measurementGranted: state.consents.measurement,
      })
    })

    expect(
      restorePersistedConsent({
        consents: store.getState().consents,
        persistedConsent: createPersistedConsent(storedConsents),
        saveConsents: store.getState().saveConsents,
        setSelectedConsent: store.getState().setSelectedConsent,
      }),
    ).toBe(true)
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: store.getState().consents.measurement,
    })

    expect(store.getState().consents).toEqual(storedConsents)
    expect(ownedBeacons(head)).toHaveLength(1)

    await nextTask()
    expect(manager.setConsent).toHaveBeenCalledOnce()
    expect(manager.setConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ preferences: storedConsents }),
      }),
    )
    unsubscribe()
  })

  it("replaces stale live categories with the stored profile verbatim", async () => {
    const manager = createManagerHarness()
    const store = createConsentManagerStore(manager, {
      initialGdprTypes: ["necessary", "measurement"],
    })
    const staleConsents = {
      experience: true,
      functionality: true,
      marketing: true,
      measurement: false,
      necessary: true,
    } satisfies ConsentState
    store.setState({
      consents: staleConsents,
      selectedConsents: staleConsents,
    })
    vi.stubGlobal("window", { location: { hostname: "zurielst.com" } })

    expect(
      restorePersistedConsent({
        consents: store.getState().consents,
        persistedConsent: createPersistedConsent(storedConsents),
        saveConsents: store.getState().saveConsents,
        setSelectedConsent: store.getState().setSelectedConsent,
      }),
    ).toBe(true)
    expect(store.getState().consents).toEqual(storedConsents)
    expect(store.getState().selectedConsents).toEqual(storedConsents)

    await nextTask()
    expect(manager.setConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          metadata: expect.objectContaining({ acceptanceMethod: "custom" }),
          preferences: storedConsents,
        }),
      }),
    )
  })

  it("fails closed when the persisted category profile is incomplete", () => {
    const manager = createManagerHarness()
    const store = createConsentManagerStore(manager, {
      initialGdprTypes: ["necessary", "measurement"],
    })
    const initialConsents = store.getState().consents

    expect(
      restorePersistedConsent({
        consents: initialConsents,
        persistedConsent: {
          consentInfo: { identified: false, time: 1_756_684_800 },
          consents: { measurement: true, necessary: true },
        },
        saveConsents: store.getState().saveConsents,
        setSelectedConsent: store.getState().setSelectedConsent,
      }),
    ).toBe(false)
    expect(store.getState().consents).toBe(initialConsents)
    expect(manager.setConsent).not.toHaveBeenCalled()
  })

  it("fails closed when persisted storage disables necessary consent", () => {
    const manager = createManagerHarness()
    const store = createConsentManagerStore(manager, {
      initialGdprTypes: ["necessary", "measurement"],
    })
    const initialConsents = store.getState().consents

    expect(
      restorePersistedConsent({
        consents: initialConsents,
        persistedConsent: createPersistedConsent({
          ...storedConsents,
          necessary: false,
        }),
        saveConsents: store.getState().saveConsents,
        setSelectedConsent: store.getState().setSelectedConsent,
      }),
    ).toBe(false)
    expect(store.getState().consents).toBe(initialConsents)
    expect(manager.setConsent).not.toHaveBeenCalled()
  })
})

function createPersistedConsent(consents: ConsentState): PersistedConsent {
  return {
    consentInfo: { identified: false, time: 1_756_684_800 },
    consents,
  }
}

function createManagerHarness() {
  return {
    setConsent: vi.fn(async () => ({
      data: null,
      error: null,
      ok: true,
      response: null,
    })),
  } as unknown as ConsentManagerInterface & {
    setConsent: ReturnType<typeof vi.fn>
  }
}

function nextTask() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function createDocumentHarness() {
  const head: FakeHead = {
    scripts: [],
    appendChild(script) {
      this.scripts.push(script)
      script.parentNode = this
      return script
    },
    removeChild(script) {
      this.scripts = this.scripts.filter((candidate) => candidate !== script)
      script.parentNode = null
      return script
    },
  }
  const document = {
    head,
    createElement() {
      const attributes = new Map<string, string>()
      return {
        attributes,
        defer: false,
        getAttribute(name: string) {
          return attributes.get(name) ?? null
        },
        parentNode: null,
        setAttribute(name: string, value: string) {
          attributes.set(name, value)
        },
        src: "",
      } satisfies FakeScript
    },
    querySelector(selector: string) {
      if (selector !== '[data-zst-cloudflare-analytics="true"]') return null
      return (
        head.scripts.find(
          (script) =>
            script.getAttribute("data-zst-cloudflare-analytics") === "true",
        ) ?? null
      )
    },
  }

  return { document: document as unknown as Document, head }
}

function ownedBeacons(head: FakeHead) {
  return head.scripts.filter(
    (script) => script.getAttribute("data-zst-cloudflare-analytics") === "true",
  )
}
