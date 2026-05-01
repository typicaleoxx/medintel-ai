// this file redirects the root url to the doctor page
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/doctor")
}
