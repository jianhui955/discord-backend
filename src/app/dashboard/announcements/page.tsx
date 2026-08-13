import { createClient } from "@/lib/supabase/server";
import { AnnouncementsManager } from "@/components/announcements-manager";
import {
  mapAnnouncementRow,
  type Announcement,
  type Sticker,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const supabase = await createClient();

  const [announcementsResult, stickersResult] = await Promise.all([
    supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("sticker")
      .select("pic_name, pic_code, pic_discord_id")
      .order("pic_name", { ascending: true }),
  ]);

  const announcements = (
    (announcementsResult.data ?? []) as Record<string, unknown>[]
  ).map((row) => mapAnnouncementRow(row) as Announcement);

  const stickers = ((stickersResult.data ?? []) as Sticker[]).map((s) => ({
    pic_name: String(s.pic_name ?? ""),
    pic_code: String(s.pic_code ?? ""),
    pic_discord_id: String(s.pic_discord_id ?? "").trim(),
  }));

  const error = announcementsResult.error ?? stickersResult.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">公告</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理定时公告内容、发送周几与时间
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请确认已在 Supabase 中建好{" "}
            <code>announcements</code> 表，并配置 RLS 策略。
          </p>
        </div>
      ) : null}

      <AnnouncementsManager
        announcements={announcements}
        stickers={stickers}
      />
    </div>
  );
}
