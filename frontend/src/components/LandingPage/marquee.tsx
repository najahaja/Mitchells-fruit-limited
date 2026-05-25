// import { useEffect, useRef } from "react";

// import logo1 from "../../assets/images/left.avif";
// import logo2 from "../../assets/images/right.avif";

// const row1 = [
//   { bg: "#29b5e8", label: "OLO", src: "" },
//   { bg: "#000000", label: "●", src: logo2 },
//   { bg: "#2e7d32", label: "⁛", src: "" },
//   { bg: "#1a1a1a", label: "▣", src: "" },
//   { bg: "#f04e23", label: "🍞", src: "" },
//   { bg: "#0d2240", label: "◑", src: "" },
//   { bg: "#ffffff", label: "④", src: "" },
//   { bg: "#4caf50", label: "Aloha", src: "" },
//   { bg: "#c62828", label: "🔥", src: "" },
//   { bg: "#388e3c", label: "∞", src: "" },
// ];

// const row2 = [
//   { bg: "#7c3aed", label: "✳", src: "" },
//   { bg: "#f04e23", label: "G", src: "" },
//   { bg: "#0d5c7a", label: "Focus", src: "" },
//   { bg: "#c62828", label: "◎", src: "" },
//   { bg: "#1565c0", label: "✦", src: "" },
//   { bg: "#29b5e8", label: "olo", src: "" },
//   { bg: "#111111", label: "Otter", src: "" },
//   { bg: "#f04e23", label: "🍞", src: "" },
//   { bg: "#000000", label: "●", src: "" },
//   { bg: "#2e7d32", label: "⁛", src: "" },
//   { bg: "#1a1a1a", label: "▣", src: "" },
// ];

// const doubled1 = [...row1, ...row1];
// const doubled2 = [...row2, ...row2];

// const LOGO_SIZE = 230;
// const GAP = 20;
// const STEP = LOGO_SIZE + GAP;

// const LogoBox = ({ item }: { item: (typeof row1)[0] }) => (
//   <div
//     className="flex-shrink-0 flex items-center justify-center rounded-2xl font-black select-none"
//     style={{
//       width: LOGO_SIZE,
//       height: LOGO_SIZE,
//       background: item.bg,
//       color: item.bg === "#ffffff" ? "#000" : "#fff",
//       fontSize: item.label.length > 10 ? 13 : 40,
//       fontFamily: "'Fff Acidgrotesk', 'Arial Black', sans-serif",
//       letterSpacing: "-0.02em",
//       overflow: "hidden",
//     }}
//   >
//     {item.src ? (
//       <img
//         src={item.src}
//         alt={item.label}
//         className="w-full h-full object-contain p-3"
//       />
//     ) : (
//       item.label
//     )}
//   </div>
// );

// export default function IntegrationsMarquee() {
//   const lastScrollY = useRef(
//     typeof window !== "undefined" ? window.scrollY : 0,
//   );
//   const pos1 = useRef(0);
//   const pos2 = useRef(-(STEP * 2));
//   const row1Ref = useRef<HTMLDivElement>(null);
//   const row2Ref = useRef<HTMLDivElement>(null);

//   const totalWidth = STEP * row1.length;

//   useEffect(() => {
//     const SCROLL_MULTIPLIER = 0.4; // how much marquee moves per scroll px

//     const onScroll = () => {
//       const current = window.scrollY;
//       const delta = current - lastScrollY.current; // positive = down, negative = up
//       lastScrollY.current = current;

//       // row1: follows scroll direction, row2: opposite
//       pos1.current -= delta * SCROLL_MULTIPLIER;
//       pos2.current += delta * SCROLL_MULTIPLIER;

//       // Seamless loop
//       if (pos1.current <= -totalWidth) pos1.current += totalWidth;
//       if (pos1.current >= 0) pos1.current -= totalWidth;
//       if (pos2.current <= -totalWidth) pos2.current += totalWidth;
//       if (pos2.current >= 0) pos2.current -= totalWidth;

//       if (row1Ref.current)
//         row1Ref.current.style.transform = `translateX(${pos1.current}px)`;
//       if (row2Ref.current)
//         row2Ref.current.style.transform = `translateX(${pos2.current}px)`;
//     };

//     window.addEventListener("scroll", onScroll, { passive: true });
//     return () => window.removeEventListener("scroll", onScroll);
//   }, [totalWidth]);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.cdnfonts.com/css/grotesk');
//         .im-font { font-family: 'Fff Acidgrotesk', sans-serif; }
//         .im-fade {
//           mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
//           -webkit-mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
//         }
//       `}</style>

//       <section className="im-font w-full py-14 overflow-hidden">
//         {/* Heading */}
//         <div className=" mb-10 px-4 mx-40">
//           <p
//             className="im-font text-2xl font-extrabold sm:text-3xl lg:text-[52px]"
//             style={{ color: "#888" }}
//           >
//             Integrates with{" "}
//             <strong style={{ color: "#111" }}>
//               your
//               <br />
//               existing restaurant stack
//             </strong>
//           </p>
//         </div>

//         {/* Row 1 */}
//         <div className="im-fade overflow-hidden mb-3">
//           <div
//             ref={row1Ref}
//             className="flex will-change-transform"
//             style={{ gap: GAP, paddingLeft: GAP }}
//           >
//             {doubled1.map((item, i) => (
//               <LogoBox key={i} item={item} />
//             ))}
//           </div>
//         </div>

//         {/* Row 2 */}
//         <div className="im-fade overflow-hidden">
//           <div
//             ref={row2Ref}
//             className="flex will-change-transform"
//             style={{ gap: GAP, paddingLeft: GAP }}
//           >
//             {doubled2.map((item, i) => (
//               <LogoBox key={i} item={item} />
//             ))}
//           </div>
//         </div>
//       </section>
//     </>
//   );
// }

import { useEffect, useRef } from "react";

// ── Replace these with your actual SVG imports ──
import row1Svg from "../../assets/images/testline.svg";
import row2Svg from "../../assets/images/testline2.svg";

// Each SVG is a single image containing 11 logos in a row.
// We duplicate it 3x to ensure seamless infinite loop at any screen width.
const COPIES = 3;

export default function IntegrationsMarquee() {
  const lastScrollY = useRef(
    typeof window !== "undefined" ? window.scrollY : 0,
  );
  const pos1 = useRef(0);
  const pos2 = useRef(0);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);
  // We'll measure the single SVG width after mount
  const svgWidth1 = useRef(0);
  const svgWidth2 = useRef(0);

  useEffect(() => {
    // Measure the natural width of one SVG copy
    const img1 = row1Ref.current?.querySelector("img");
    const img2 = row2Ref.current?.querySelector("img");

    const measure = () => {
      if (img1) svgWidth1.current = img1.offsetWidth;
      if (img2) svgWidth2.current = img2.offsetWidth;
    };

    // Measure after images load
    if (img1?.complete) measure();
    else img1?.addEventListener("load", measure);

    return () => img1?.removeEventListener("load", measure);
  }, []);

  useEffect(() => {
    const SCROLL_MULTIPLIER = 0.5;

    const onScroll = () => {
      const current = window.scrollY;
      const delta = current - lastScrollY.current;
      lastScrollY.current = current;

      const w1 =
        svgWidth1.current || (row1Ref.current?.offsetWidth ?? 1200) / COPIES;
      const w2 =
        svgWidth2.current || (row2Ref.current?.offsetWidth ?? 1200) / COPIES;

      // row1: scroll down = move left (negative), row2: opposite
      pos1.current -= delta * SCROLL_MULTIPLIER;
      pos2.current += delta * SCROLL_MULTIPLIER;

      // Seamless loop — reset by one SVG width
      if (pos1.current <= -w1) pos1.current += w1;
      if (pos1.current > 0) pos1.current -= w1;
      if (pos2.current <= -w2) pos2.current += w2;
      if (pos2.current > 0) pos2.current -= w2;

      if (row1Ref.current)
        row1Ref.current.style.transform = `translateX(${pos1.current}px)`;
      if (row2Ref.current)
        row2Ref.current.style.transform = `translateX(${pos2.current}px)`;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        .im-fade {
          mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
        }
      `}</style>

      <section className="font-acid w-full py-14 overflow-hidden">
        {/* Heading */}
        <div className="mb-10 px-4 mx-auto max-w-6xl">
          <p
            className="font-acid text-2xl font-extrabold sm:text-3xl lg:text-[52px]"
            style={{ color: "#888" }}
          >
            Integrates with{" "}
            <strong style={{ color: "#111" }}>
              your
              <br />
              existing business stack
            </strong>
          </p>
        </div>

        {/* Row 1 — scrolls left on scroll-down */}
        <div className="im-fade overflow-hidden mb-4">
          <div
            ref={row1Ref}
            className="flex will-change-transform"
            style={{ width: "max-content", gap: "20px" }}
          >
            {Array.from({ length: COPIES }).map((_, i) => (
              <img
                key={i}
                src={row1Svg}
                alt=""
                draggable={false}
                className="h-32 sm:h-40 lg:h-48 w-auto flex-shrink-0 select-none"
              />
            ))}
          </div>
        </div>

        {/* Row 2 — scrolls right on scroll-down */}
        <div className="im-fade overflow-hidden">
          <div
            ref={row2Ref}
            className="flex will-change-transform"
            style={{ width: "max-content", gap: "20px" }}
          >
            {Array.from({ length: COPIES }).map((_, i) => (
              <img
                key={i}
                src={row2Svg}
                alt=""
                draggable={false}
                className="h-32 sm:h-40 lg:h-48 w-auto flex-shrink-0 select-none"
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
