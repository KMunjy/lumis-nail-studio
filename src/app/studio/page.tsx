import { redirect } from "next/navigation";
import { products } from "@/data/products";

export default function StudioIndex() {
  if (products.length > 0) {
    redirect(`/studio/${products[0].id}`);
  }
  
  redirect("/");
}
