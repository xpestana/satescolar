import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import createAdminUser from "../create-admin-user/index.ts";
import createFamily from "../create-family/index.ts";
import createSystemAdmin from "../create-system-admin/index.ts";
import createTeacher from "../create-teacher/index.ts";
import deleteUser from "../delete-user/index.ts";
import fetchBcvRates from "../fetch-bcv-rates/index.ts";
import getUserEmails from "../get-user-emails/index.ts";
import impersonateUser from "../impersonate-user/index.ts";
import recordAttendance from "../record-attendance/index.ts";
import resendWelcomeEmail from "../resend-welcome-email/index.ts";
import s3MigrateExisting from "../s3-migrate-existing/index.ts";
import s3SignUpload from "../s3-sign-upload/index.ts";
import sendDelinquencyReminders from "../send-delinquency-reminders/index.ts";
import sendEmail from "../send-email/index.ts";
import suspendUser from "../suspend-user/index.ts";
import updateFamilyEmail from "../update-family-email/index.ts";
import updateFamilyPassword from "../update-family-password/index.ts";
import updateSystemAdmin from "../update-system-admin/index.ts";
import updateTeacherPassword from "../update-teacher-password/index.ts";

const staticHandlers: Record<string, (req: Request) => Promise<Response>> = {
  "create-admin-user": (req) => createAdminUser(req),
  "create-family": (req) => createFamily(req),
  "create-system-admin": (req) => createSystemAdmin(req),
  "create-teacher": (req) => createTeacher(req),
  "delete-user": (req) => deleteUser(req),
  "fetch-bcv-rates": (req) => fetchBcvRates(req),
  "get-user-emails": (req) => getUserEmails(req),
  "impersonate-user": (req) => impersonateUser(req),
  "record-attendance": (req) => recordAttendance(req),
  "resend-welcome-email": (req) => resendWelcomeEmail(req),
  "s3-migrate-existing": (req) => s3MigrateExisting(req),
  "s3-sign-upload": (req) => s3SignUpload(req),
  "send-delinquency-reminders": (req) => sendDelinquencyReminders(req),
  "send-email": (req) => sendEmail(req),
  "suspend-user": (req) => suspendUser(req),
  "update-family-email": (req) => updateFamilyEmail(req),
  "update-family-password": (req) => updateFamilyPassword(req),
  "update-system-admin": (req) => updateSystemAdmin(req),
  "update-teacher-password": (req) => updateTeacherPassword(req),
};

serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0];

  if (!functionName) {
    return new Response(JSON.stringify({ error: "Function name required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const staticFn = staticHandlers[functionName];
  if (!staticFn) {
    return new Response(JSON.stringify({ error: `Function '${functionName}' not found` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return await staticFn(req);
});