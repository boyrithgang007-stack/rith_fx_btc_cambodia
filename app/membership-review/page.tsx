import type { Metadata } from "next";
import ReviewForm from "./ReviewForm";
export const metadata: Metadata = {title:"Review membership · Edikiter",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function MembershipReviewPage() { return <ReviewForm/>; }
