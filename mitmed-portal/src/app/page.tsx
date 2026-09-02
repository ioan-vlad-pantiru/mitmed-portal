import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === Role.CLIENT ? "/portal" : "/admin");
}
