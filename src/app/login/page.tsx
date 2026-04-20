import { signIn, auth } from "../../../auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ADMIN_COOKIE_NAME, adminPasswordEnabled, verifyAdminCookie } from "@/lib/admin-cookie";
import { PasswordLoginForm } from "./password-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  // Already authed via Google? → bounce
  try {
    const session = await auth();
    if (session?.user) redirect("/");
  } catch { /* OAuth not configured — OK */ }

  // Already authed via admin cookie? → bounce
  const jar = await cookies();
  if (verifyAdminCookie(jar.get(ADMIN_COOKIE_NAME)?.value)) redirect("/");

  const { error, callbackUrl } = await searchParams;
  const next = callbackUrl ?? "/";
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.NEXTAUTH_SECRET);
  const hasPassword = adminPasswordEnabled();
  const hasBearer = Boolean(process.env.GATEWAY_API_KEY);

  const h = await headers();
  const host = h.get("host") ?? "your-gateway";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}/v1`;

  return (
    <main className="min-h-screen flex items-start justify-center bg-neutral-950 text-neutral-100 p-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">SMLGateway</h1>
          <p className="text-sm text-neutral-400">เลือกวิธี login 1 ใน 3 แบบ</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            Sign-in failed. {error === "AccessDenied" ? "Email not verified." : "Please try again."}
          </div>
        )}

        {/* ─── Method 1: Google OAuth ─────────────────────────────── */}
        <MethodCard
          tag="1"
          tagColor="bg-blue-500"
          title="เข้าด้วย Google"
          subtitle="สำหรับ admin ที่มี Gmail และอยู่ใน AUTH_OWNER_EMAIL"
          tagLabel={hasGoogle ? "" : "ยังไม่ตั้งค่า"}
          disabled={!hasGoogle}
        >
          {hasGoogle ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: next });
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-md bg-white text-neutral-900 font-medium px-4 py-2.5 hover:bg-neutral-100 transition"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.3c-2 1.5-4.5 2.5-7.5 2.5-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.5 5.3C41.4 36.5 44 31 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          ) : (
            <div className="text-xs text-neutral-500 italic">
              Admin ต้องตั้ง <code>GOOGLE_CLIENT_ID/SECRET</code> + <code>NEXTAUTH_SECRET/URL</code> ใน <code>.env</code>
            </div>
          )}
        </MethodCard>

        {/* ─── Method 2: Password ─────────────────────────────────── */}
        <MethodCard
          tag="2"
          tagColor="bg-amber-500"
          title="เข้าด้วย Admin Password"
          subtitle="สำหรับกรณีไม่มี Gmail หรือ Google ล่ม — signed cookie หมดอายุ 7 วัน"
          tagLabel={hasPassword ? "" : "ยังไม่ตั้งค่า"}
          disabled={!hasPassword}
        >
          {hasPassword ? (
            <PasswordLoginForm next={next} />
          ) : (
            <div className="text-xs text-neutral-500 italic">
              Admin ต้องตั้ง <code>ADMIN_PASSWORD</code> ใน <code>.env</code> (≥ 4 chars, แนะนำ ≥ 20)
            </div>
          )}
        </MethodCard>

        {/* ─── Method 3: Bearer Key (API client) ──────────────────── */}
        <MethodCard
          tag="3"
          tagColor="bg-neutral-500"
          title="Bearer API Key (สำหรับ client / SDK)"
          subtitle="ไม่ต้อง login ที่หน้าเว็บ — ใส่ header Authorization ใน request เอง"
          tagLabel={hasBearer ? "" : "ยังไม่ตั้งค่า"}
          disabled={!hasBearer}
        >
          {hasBearer ? (
            <div className="space-y-2">
              <div className="text-xs text-neutral-400">
                ใช้กับ OpenAI SDK / curl / automation. ไม่มี session / cookie — ส่ง key ทุก request.
              </div>
              <pre className="text-[11px] font-mono bg-black/60 border border-neutral-800 rounded p-3 overflow-x-auto text-neutral-300">
{`from openai import OpenAI
client = OpenAI(
    base_url="${baseUrl}",
    api_key="sk-gw-..."   # master
    # api_key="sml_live_..."  # per-client (ออกที่ /admin/keys)
)`}
              </pre>
              <div className="text-[11px] text-neutral-500">
                ดูตัวอย่าง Python/Node/LangChain/Hermes/OpenClaw ที่{" "}
                <a href="/guide" className="text-indigo-400 hover:underline">/guide</a>
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-500 italic">
              Admin ต้องตั้ง <code>GATEWAY_API_KEY</code> ใน <code>.env</code> (หรือใช้ master + ออก key ที่ <code>/admin/keys</code>)
            </div>
          )}
        </MethodCard>

        {!hasGoogle && !hasPassword && !hasBearer && (
          <div className="rounded-md border border-amber-900/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-300 text-center">
            ⚠️ ไม่มีวิธี login ที่เปิดใช้ — admin ต้องตั้งอย่างน้อย 1 env ใน <code>.env.production</code>
          </div>
        )}

        <div className="text-center text-[11px] text-neutral-600">
          <a href="/" className="hover:text-neutral-400">← กลับ Dashboard</a>
        </div>
      </div>
    </main>
  );
}

// ─── Helper: consistent card around each method ──────────────────
function MethodCard({
  tag,
  tagColor,
  title,
  subtitle,
  tagLabel,
  disabled,
  children,
}: {
  tag: string;
  tagColor: string;
  title: string;
  subtitle: string;
  tagLabel: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-5 space-y-4 ${
        disabled ? "border-neutral-800/50 bg-neutral-900/30 opacity-70" : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`${tagColor} h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white shadow`}
        >
          {tag}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-neutral-100">{title}</h2>
            {tagLabel && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500 border border-neutral-700">
                {tagLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className={disabled ? "pointer-events-none" : ""}>{children}</div>
    </section>
  );
}
