precision highp float;

/*
  Investi Loop — signature material.
  A raymarched liquid-chrome ribbon with a Möbius half-twist:
  one continuous surface = learn → practice → progress → learn.
  Thin-film iridescence on grazing angles, blue–violet studio softboxes.
*/

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/** @mouse */
uniform vec2 u_mouse;

/**
 * @label Spin phase
 * @default 0.6
 * @range -3.14, 3.14
 */
uniform float u_phase;

/**
 * @label Tilt
 * @default 0.55
 * @range -1.5, 1.5
 */
uniform float u_tilt;

/**
 * @label Roll
 * @default -0.25
 * @range -1.5, 1.5
 */
uniform float u_roll;

/**
 * @label Half twists (odd = Möbius)
 * @default 1
 * @range 1, 5
 */
uniform float u_twist;

/**
 * @label Ribbon width
 * @default 0.42
 * @range 0.1, 0.7
 */
uniform float u_width;

/**
 * @label Liquid distortion
 * @default 0.6
 * @range 0, 2
 */
uniform float u_distort;

/**
 * @label Iridescence
 * @default 0.55
 * @range 0, 1
 */
uniform float u_irid;

/**
 * @label Zoom
 * @default 1
 * @range 0.4, 2.5
 */
uniform float u_zoom;

/**
 * @label Dark studio (0 light, 1 dark)
 * @default 0
 * @range 0, 1
 */
uniform float u_dark;

/**
 * @label Animation speed
 * @default 0
 * @range 0, 1
 */
uniform float u_speed;

/**
 * @label Pointer response
 * @default 0
 * @range 0, 1
 */
uniform float u_interact;

/**
 * @label Signature violet
 * @color
 * @default #6B5CFF
 */
uniform vec3 u_violet;

/**
 * @label Electric blue
 * @color
 * @default #2E6BFF
 */
uniform vec3 u_blue;

float T;
mat3 ROT;

mat2 r2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0); }

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float map(vec3 p) {
  p = ROT * p;
  float a = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz) - 1.0, p.y);
  q = r2(a * floor(u_twist + 0.5) * 0.5 + 0.35 * sin(a * 2.0 + T)) * q;
  float w = u_width * (0.82 + 0.18 * sin(a * 3.0 + T * 0.8));
  float d = sdRoundRect(q, vec2(w, 0.055), 0.05);
  d += u_distort * 0.018 * sin(4.0 * p.x + T * 1.3) * sin(5.0 * p.y - T) * sin(4.5 * p.z + 0.7);
  return d * 0.55;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

vec3 env(vec3 r) {
  float y = r.y;
  float az = atan(r.x, r.z);
  vec3 skyL = mix(vec3(0.90, 0.90, 0.94), vec3(1.0), smoothstep(0.0, 0.7, y));
  vec3 grdL = mix(vec3(0.20, 0.20, 0.26), vec3(0.66, 0.66, 0.74), smoothstep(-0.9, -0.02, y));
  vec3 skyD = mix(vec3(0.05, 0.05, 0.08), vec3(0.16, 0.16, 0.22), smoothstep(0.0, 0.8, y));
  vec3 grdD = mix(vec3(0.0), vec3(0.06, 0.06, 0.09), smoothstep(-0.9, 0.0, y));
  vec3 sky = mix(skyL, skyD, u_dark);
  vec3 grd = mix(grdL, grdD, u_dark);
  vec3 col = mix(grd, sky, smoothstep(-0.04, 0.04, y));
  float vBand = exp(-pow((az - 1.25) / 0.28, 2.0)) * smoothstep(-0.35, 0.35, y);
  float bBand = exp(-pow((az + 1.9) / 0.32, 2.0)) * smoothstep(-0.7, 0.1, y) * (1.0 - smoothstep(0.4, 0.9, y));
  float lilac = exp(-pow((az - 2.7) / 0.35, 2.0)) * smoothstep(0.1, 0.6, y);
  col = mix(col, u_violet * (1.0 + 0.6 * u_dark), clamp(vBand * 0.95, 0.0, 1.0));
  col = mix(col, u_blue * (1.0 + 0.6 * u_dark), clamp(bBand * 0.85, 0.0, 1.0));
  col = mix(col, mix(vec3(0.80, 0.78, 1.0), u_violet * 1.4, u_dark), clamp(lilac * 0.8, 0.0, 1.0));
  vec3 key = normalize(vec3(-0.45, 0.75, 0.6));
  col += vec3(1.0, 0.99, 1.0) * (1.6 * pow(max(dot(r, key), 0.0), 60.0) + 0.25 * pow(max(dot(r, key), 0.0), 6.0));
  float strip = smoothstep(0.06, 0.0, abs(az + 0.35)) * smoothstep(0.15, 0.55, y);
  col += vec3(1.0) * strip * (0.9 + 0.6 * u_dark);
  return col;
}

vec3 shade(vec3 p, vec3 rd) {
  vec3 n = calcNormal(p);
  vec3 v = -rd;
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  vec3 r = reflect(rd, n);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 col = env(r) * mix(vec3(0.80, 0.81, 0.88), vec3(1.0), 0.35 + 0.65 * fres);
  vec3 irid = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.28, 0.62) + ndv * 1.7 + 0.15 * T));
  irid = mix(irid, vec3(0.62, 0.58, 1.0), 0.35);
  col = mix(col, col * irid * 1.6 + irid * 0.08, u_irid * (0.15 + 0.7 * fres));
  float ao = clamp(map(p + n * 0.12) / 0.066, 0.0, 1.0);
  col *= 0.62 + 0.38 * ao;
  col += u_violet * 0.25 * pow(1.0 - ndv, 5.0) * (1.0 + u_dark);
  return col;
}

void main() {
  T = u_time * u_speed;
  vec2 res = u_resolution;
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  vec2 m = (u_mouse / res - 0.5) * u_interact;
  ROT = rotZ(u_roll + m.x * 0.4) * rotX(u_tilt - m.y * 0.6) * rotY(u_phase + T * 0.6 + m.x * 0.9);

  vec3 ro = vec3(0.0, 0.0, 5.4 / u_zoom);
  vec3 rd = normalize(vec3(uv, -1.45));
  float px = 1.2 / (min(res.x, res.y) * 1.45);

  float t = 0.0;
  float minD = 1e9;
  float minT = 0.0;
  bool hit = false;
  for (int i = 0; i < 110; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < minD) { minD = d; minT = t; }
    if (d < 0.0004) { hit = true; break; }
    t += d;
    if (t > 9.0) break;
  }

  if (hit) {
    gl_FragColor = vec4(clamp(shade(ro + rd * t, rd), 0.0, 1.0), 1.0);
  } else {
    float cov = 1.0 - smoothstep(0.0, px * minT * 0.55, minD);
    if (cov <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec3 c = clamp(shade(ro + rd * minT, rd), 0.0, 1.0);
    gl_FragColor = vec4(c * cov, cov);
  }
}
