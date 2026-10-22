import { describe, expect, it } from "vitest";
import { countsLandingView } from "./landing-view-beacon";

const sendBeacon = () => true;

describe("countsLandingView", () => {
  it("counts an ordinary browser", () => {
    expect(countsLandingView({ doNotTrack: null, sendBeacon })).toBe(true);
    expect(countsLandingView({ doNotTrack: "0", globalPrivacyControl: false, sendBeacon })).toBe(true);
  });

  it("respects Global Privacy Control and Do Not Track", () => {
    expect(countsLandingView({ doNotTrack: null, globalPrivacyControl: true, sendBeacon })).toBe(false);
    expect(countsLandingView({ doNotTrack: "1", sendBeacon })).toBe(false);
  });

  it("skips browsers without beacons instead of falling back to another channel", () => {
    expect(countsLandingView({ doNotTrack: null })).toBe(false);
  });
});
