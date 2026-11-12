"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireRole } from "@/lib/auth";
import { TAG } from "@/lib/community";
import { requireSql } from "@/lib/db";
import * as repo from "@/lib/repo";


const UUID = /^[0-9a-f-]{36}$/i;

export async function moderateReviewAction(fd: FormData) {
  await requireRole("editor");
  const id = String(fd.get("id"));
  const decision = fd.get("decision");
  if (!UUID.test(id) || (decision !== "approved" && decision !== "rejected")) return;
  const note = String(fd.get("note") ?? "").trim() || null;
  const slug = await repo.moderateReview(requireSql(), id, decision, note);
  if (slug) {
    updateTag(TAG.reviews(slug));
    updateTag(TAG.stats);
  }
  revalidatePath("/admin", "layout");
}

export async function updateInquiryAction(fd: FormData) {
  await requireRole("editor");
  const id = String(fd.get("id"));
  const status = fd.get("status");
  if (!UUID.test(id) || (status !== "new" && status !== "forwarded" && status !== "closed")) return;
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000) || null;
  await repo.updateInquiry(requireSql(), id, status, note);
  revalidatePath("/admin", "layout");
}
