import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth";
import { ThemeScope } from "@/app/ThemeControls";
import SupportContactForm from "./SupportContactForm";

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return <ThemeScope>
    <SupportContactForm email={user.email} />
  </ThemeScope>;
}
