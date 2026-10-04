import { ADMIN_PREFIX, CLIENT_WORKSPACE_PREFIX } from "../src/config/app";

type SmokeKind = "ok" | "redirect" | "guest-invalid";

type SmokeCase = {
  path: string;
  kind: SmokeKind;
  allow?: number[];
};

const CASES: SmokeCase[] = [
  { path: "/", kind: "ok" },
  { path: "/product", kind: "ok" },
  { path: "/guest-experience", kind: "ok" },
  { path: "/property-experience", kind: "ok" },
  { path: "/operations", kind: "ok" },
  { path: "/services", kind: "ok" },
  { path: "/pricing", kind: "ok" },
  { path: "/about", kind: "ok" },
  { path: "/contact", kind: "ok" },
  { path: "/faq", kind: "ok" },
  { path: "/privacy", kind: "ok" },
  { path: "/terms", kind: "ok" },
  { path: "/signup", kind: "ok" },
  { path: "/signup?plan=starter", kind: "ok" },
  { path: "/signup?plan=professional", kind: "ok" },
  { path: "/signup?plan=enterprise", kind: "ok" },
  { path: "/login", kind: "ok" },
  { path: "/features", kind: "redirect" },
  { path: ADMIN_PREFIX, kind: "redirect" },
  { path: `${ADMIN_PREFIX}/login`, kind: "ok" },
  { path: `${ADMIN_PREFIX}/clients`, kind: "redirect" },
  { path: CLIENT_WORKSPACE_PREFIX, kind: "redirect" },
  { path: `${CLIENT_WORKSPACE_PREFIX}/calendar`, kind: "redirect" },
  { path: `${CLIENT_WORKSPACE_PREFIX}/properties`, kind: "redirect" },
  { path: `${CLIENT_WORKSPACE_PREFIX}/billing`, kind: "redirect" },
  { path: `${CLIENT_WORKSPACE_PREFIX}/cleaning`, kind: "redirect" },
  { path: "/o/riad-atlas", kind: "redirect" },
  { path: "/p/riad-atlas", kind: "ok" },
  { path: "/p/riad-atlas/riad-suite", kind: "ok" },
  { path: "/g/invalid-token", kind: "guest-invalid" },
];

const GENERIC_NOT_FOUND = "The requested route does not exist.";
const GUEST_INVALID = "This guest link is not valid";

async function probe(baseUrl: string, path: string) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  const location = response.headers.get("location");
  const body = response.status < 400 || response.status === 404 ? await response.text() : "";

  return {
    status: response.status,
    location,
    genericNotFound: body.includes(GENERIC_NOT_FOUND) && /<h1[^>]*>Page not found<\/h1>/i.test(body),
    guestInvalid: body.includes(GUEST_INVALID),
  };
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
  const failures: string[] = [];

  for (const testCase of CASES) {
    const result = await probe(baseUrl, testCase.path);
    const label = `${testCase.path} → ${result.status}${result.location ? ` ${result.location}` : ""}`;

    if (result.genericNotFound) {
      failures.push(`${label} unexpected Next.js not-found`);
      continue;
    }

    if (testCase.kind === "ok" && result.status !== 200) {
      failures.push(`${label} expected 200`);
    } else if (testCase.kind === "redirect" && !isRedirect(result.status)) {
      failures.push(`${label} expected redirect`);
    } else if (testCase.kind === "guest-invalid" && (result.status !== 200 || !result.guestInvalid)) {
      failures.push(`${label} expected guest-invalid experience`);
    } else {
      console.log(`ok  ${label}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nRoute smoke failures:");
    for (const failure of failures) {
      console.error(`fail ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
