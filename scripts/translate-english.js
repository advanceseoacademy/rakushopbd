/**
 * One-time script: convert Bengali UI strings to English across project files.
 * Run: node scripts/translate-english.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const pairs = [
  // HTML head & global
  ['lang="bn"', 'lang="en"'],
  ['Hind+Siliguri', 'Inter'],
  ["family=Hind+Siliguri:wght@400;500;600;700", "family=Inter:wght@400;500;600;700"],
  ['RakuShopBD — সেরা অনলাইন শপিং', 'RakuShopBD — Best Online Shopping'],
  ['বিশেষ অফার: ৳১০০০+ অর্ডারে ১০% ছাড় — কোড:', 'Special offer: 10% off on orders over ৳1000 — Code:'],
  ['সব পণ্য', 'All Products'],
  ['ইলেকট্রনিক্স', 'Electronics'],
  ['ফ্যাশন', 'Fashion'],
  ['খাবার', 'Food'],
  ['হোম', 'Home'],
  ['কি খুঁজছেন? পণ্যের নাম লিখুন...', 'What are you looking for? Search products...'],
  ['উইশলিস্ট', 'Wishlist'],
  ['কার্ট', 'Cart'],
  ['অ্যাকাউন্ট', 'Account'],
  ['হোমপেজ', 'Home'],
  ['বিউটি', 'Beauty'],
  ['হোম & লিভিং', 'Home & Living'],
  ['স্পোর্টস', 'Sports'],
  ['বই & শিক্ষা', 'Books & Education'],
  ['শিশু পণ্য', 'Kids'],
  ['অটোমোবাইল', 'Automotive'],
  ['সেল & অফার', 'Sale & Offers'],
  ['ফ্ল্যাশ সেল চলছে', 'Flash sale live'],
  ['সেরা পণ্য<br>সেরা দামে!', 'Best products<br>Best prices!'],
  ['লক্ষাধিক পণ্য থেকে বেছে নিন — ঘরে বসেই পান', 'Choose from thousands of products — delivered to your door'],
  ['এখনই কিনুন', 'Shop Now'],
  ['ক্যাটাগরি দেখুন', 'Browse Categories'],
  ['সারা বাংলাদেশে', 'Nationwide'],
  ['ফ্রি ডেলিভারি', 'Free Delivery'],
  ['আজকের অফার', "Today's deal"],
  ['৫০% পর্যন্ত ছাড়', 'Up to 50% off'],
  ['মোট পণ্য', 'Total Products'],
  ['সন্তুষ্ট গ্রাহক', 'Happy Customers'],
  ['৬৪ জেলা', '64 Districts'],
  ['ডেলিভারি কভারেজ', 'Delivery Coverage'],
  ['২৪/৭ সাপোর্ট', '24/7 Support'],
  ['গ্রাহক সেবা', 'Customer Service'],
  ['ক্যাটাগরি অনুযায়ী কিনুন', 'Shop by Category'],
  ['সব দেখুন', 'View All'],
  ['জনপ্রিয় পণ্যসমূহ', 'Popular Products'],
  ['সব পণ্য দেখুন', 'View All Products'],
  ['সব', 'All'],
  ['বেস্ট সেলার', 'Best Seller'],
  ['হট 🔥', 'Hot 🔥'],
  ['নতুন', 'New'],
  ['দ্রুত দেখুন', 'Quick View'],
  ['কার্টে', 'Add to Cart'],
  ['কার্টে যোগ করুন', 'Add to Cart'],
  ['এখনই কিনুন', 'Buy Now'],
  ['বিনামূল্যে ডেলিভারি', 'Free delivery'],
  ['নিরাপদ পেমেন্ট', 'Secure payment'],
  ['সহজ রিটার্ন', 'Easy returns'],
  ['আসল পণ্য', 'Authentic products'],
  ['আপনার কার্ট', 'Your Cart'],
  ['টি পণ্য', ' items'],
  ['কেনাকাটা চালিয়ে যান', 'Continue Shopping'],
  ['হোমে ফিরুন', 'Back to Home'],
  ['অর্ডার সারসংক্ষেপ', 'Order Summary'],
  ['সাবটোটাল', 'Subtotal'],
  ['ডেলিভারি', 'Delivery'],
  ['মোট', 'Total'],
  ['মোট পরিশোধ', 'Total Due'],
  ['চেকআউটে যান', 'Proceed to Checkout'],
  ['কুপন কোড', 'Coupon code'],
  ['প্রয়োগ', 'Apply'],
  ['পেমেন্ট:', 'Payment:'],
  ['ব্যাংক', 'Bank'],
  ['ডেলিভারি ঠিকানা', 'Delivery Address'],
  ['পুরো নাম *', 'Full Name *'],
  ['আপনার নাম লিখুন', 'Enter your full name'],
  ['মোবাইল নম্বর *', 'Mobile Number *'],
  ['ইমেইল', 'Email'],
  ['জেলা *', 'District *'],
  ['জেলা বেছে নিন', 'Select district'],
  ['ঢাকা', 'Dhaka'],
  ['চট্টগ্রাম', 'Chittagong'],
  ['সিলেট', 'Sylhet'],
  ['রাজশাহী', 'Rajshahi'],
  ['খুলনা', 'Khulna'],
  ['বরিশাল', 'Barishal'],
  ['রংপুর', 'Rangpur'],
  ['ময়মনসিংহ', 'Mymensingh'],
  ['থানা / উপজেলা *', 'Thana / Upazila *'],
  ['থানা / উপজেলার নাম', 'Enter thana or upazila'],
  ['পোস্টাল কোড', 'Postal Code'],
  ['যেমন: ১২০০', 'e.g. 1200'],
  ['পূর্ণ ঠিকানা *', 'Full Address *'],
  ['বাড়ি নম্বর, রাস্তা, এলাকার নাম...', 'House, road, area...'],
  ['পেমেন্ট পদ্ধতি', 'Payment Method'],
  ['মোবাইল ব্যাংকিং', 'Mobile Banking'],
  ['কার্ড পেমেন্ট', 'Card Payment'],
  ['ব্যাংক ট্রান্সফার', 'Bank Transfer'],
  ['ক্যাশ অন ডেলিভারি', 'Cash on Delivery'],
  ['পণ্য পেয়ে টাকা দিন', 'Pay when you receive'],
  ['অর্ডার নোট (ঐচ্ছিক)', 'Order Notes (optional)'],
  ['বিশেষ কোনো নির্দেশনা থাকলে লিখুন...', 'Any special instructions...'],
  ['অর্ডার নিশ্চিত করুন', 'Place Order'],
  ['শিপিং', 'Shipping'],
  ['পেমেন্ট', 'Payment'],
  ['নিশ্চিতকরণ', 'Confirmation'],
  ['অর্ডার সফলভাবে হয়েছে! 🎉', 'Order placed successfully! 🎉'],
  ['আপনার অর্ডারটি নিশ্চিত করা হয়েছে। আমরা যত দ্রুত সম্ভব আপনার কাছে পৌঁছে দেব।', 'Your order has been confirmed. We will deliver it as soon as possible.'],
  ['অর্ডার ID:', 'Order ID:'],
  ['অর্ডার নিশ্চিত', 'Order confirmed'],
  ['এইমাত্র', 'Just now'],
  ['প্যাকেজিং', 'Packaging'],
  ['আজ থেকে ১-২ দিন', '1–2 days'],
  ['ডেলিভারি', 'Delivery'],
  ['২-৪ কার্যদিবস', '2–4 business days'],
  ['অর্ডার ট্র্যাক করুন', 'Track Order'],
  ['হোমে ফিরুন', 'Back to Home'],
  ['দ্রুত লিংক', 'Quick Links'],
  ['সব ক্যাটাগরি', 'All Categories'],
  ['ফ্ল্যাশ সেল', 'Flash Sale'],
  ['নতুন পণ্য', 'New Arrivals'],
  ['সাহায্য', 'Help'],
  ['অর্ডার ট্র্যাক করুন', 'Track Order'],
  ['রিটার্ন পলিসি', 'Return Policy'],
  ['শিপিং তথ্য', 'Shipping Info'],
  ['যোগাযোগ করুন', 'Contact Us'],
  ['যোগাযোগ', 'Contact'],
  ['ঢাকা, বাংলাদেশ', 'Dhaka, Bangladesh'],
  ['সকাল ৯টা — রাত ১০টা', '9 AM — 10 PM'],
  ['© ২০২৬ RakuShopBD — সর্বস্বত্ব সংরক্ষিত', '© 2026 RakuShopBD — All rights reserved'],
  ['বাংলাদেশের সেরা অনলাইন শপিং প্ল্যাটফর্ম। লক্ষাধিক পণ্য, সেরা দাম, এবং দ্রুত ডেলিভারি — আপনার সুবিধার কথা ভেবেই তৈরি।', "Bangladesh's trusted online shopping platform. Huge selection, great prices, and fast delivery."],
  ['কার্ট দেখুন', 'View cart'],
  ['বর্ণনা', 'Description'],
  ['স্পেসিফিকেশন', 'Specifications'],
  ['রিভিউ', 'Reviews'],
  ['সম্পর্কিত পণ্য', 'Related Products'],
  ['রঙ বেছে নিন', 'Choose color'],
  ['সাইজ', 'Size'],
  ['পরিমাণ', 'Quantity'],
  ['স্টকে আছে', 'In stock'],
  ['টি বাকি', ' left'],
  ['রিভিউ', 'reviews'],
  ['বিক্রি', 'sold'],
  ['সাশ্রয়', 'saved'],
  ['হট সেল', 'Hot sale'],
  ['গ্যারান্টি', 'Warranty'],
  ['মাস', 'months'],
  ['বছর', 'year'],
  ['দিন', 'days'],
  ['রিটার্ন', 'Return'],
  ['৭ দিন রিটার্ন', '7-day returns'],
  ['SSL নিরাপদ', 'SSL secured'],
  ['শর্তাবলী', 'Terms'],
  ['গোপনীয়তা নীতি', 'Privacy Policy'],
  ['অর্ডার করে আপনি আমাদের', 'By placing an order you agree to our'],
  ['মেনে নিচ্ছেন।', '.'],
  ['বিনামূল্যে', 'Free'],
  ['ফ্রি', 'Free'],
  ['পণ্যের বিবরণ', 'Product details'],
  ['পেজ পাওয়া যায়নি', 'Page not found'],
  // Product page sample
  ['স্মার্টওয়াচ প্রো — হেলথ ট্র্যাকার, GPS, AMOLED ডিসপ্লে', 'Smartwatch Pro — Health Tracker, GPS, AMOLED Display'],
  ['রিভিউ)', 'reviews)'],
  // JS app.js
  ['📱 ইলেকট্রনিক্স পণ্য', '📱 Electronics'],
  ['👗 ফ্যাশন পণ্য', '👗 Fashion'],
  ['💄 বিউটি & কেয়ার', '💄 Beauty & Care'],
  ['🏠 হোম & লিভিং পণ্য', '🏠 Home & Living'],
  ['⚽ স্পোর্টস পণ্য', '⚽ Sports'],
  ['📚 বই & শিক্ষা পণ্য', '📚 Books & Education'],
  ['🧸 শিশু পণ্য', '🧸 Kids Products'],
  ['🚗 অটোমোবাইল পণ্য', '🚗 Automotive'],
  ['পণ্যসমূহ', 'Products'],
  ['যোগ হয়েছে', 'Added'],
  ['পেমেন্ট পদ্ধতি বেছে নিন!', 'Please select a payment method!'],
  // api.js & routes
  ['পণ্য লোড করা যায়নি', 'Could not load products'],
  ['পণ্য পাওয়া যায়নি', 'Product not found'],
  ['সার্ভার ত্রুটি', 'Server error'],
  ['কার্টে যোগ করা যায়নি', 'Could not add to cart'],
  ['আইটেম পাওয়া যায়নি', 'Item not found'],
  ['কার্ট খালি', 'Cart is empty'],
  ['সব প্রয়োজনীয় তথ্য পূরণ করুন', 'Please fill in all required fields'],
  ['অর্ডার সম্পন্ন করা যায়নি', 'Could not place order'],
  ['নাম, ফোন, ঠিকানা ও জেলা পূরণ করুন!', 'Please enter name, phone, address and district!'],
  ['অর্ডার ব্যর্থ হয়েছে', 'Order failed'],
  ['টি পণ্য)', ' items)'],
  ['🛒 আপনার কার্ট', '🛒 Your Cart'],
  // server
  ['RakuShopBD চালু —', 'RakuShopBD running —'],
  // format - locale handled separately
];

function applyPairs(content) {
  let out = content;
  for (const [from, to] of pairs) {
    out = out.split(from).join(to);
  }
  return out;
}

const files = [
  'views/index.ejs',
  'public/js/app.js',
  'public/js/api.js',
  'routes/api.js',
  'server.js',
];

for (const rel of files) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  let c = fs.readFileSync(fp, 'utf8');
  c = applyPairs(c);
  fs.writeFileSync(fp, c);
  console.log('Updated:', rel);
}

// format.js locale
const formatPath = path.join(ROOT, 'lib/format.js');
let f = fs.readFileSync(formatPath, 'utf8');
f = f.replace(/bn-BD/g, 'en-US');
f = f.replace(/Bengali locale/g, 'English locale');
fs.writeFileSync(formatPath, f);
console.log('Updated: lib/format.js');

console.log('Done. Review views/index.ejs for any remaining Bengali product names in static HTML.');
