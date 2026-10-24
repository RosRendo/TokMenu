import { createContext, useContext } from "react";

export const DashContext = createContext(null);

export const useDash = () => useContext(DashContext);

export function reasonLabel(reason, tr) {
  return {
    CLOSED: tr("Outside opening hours — customers can browse but not order.", "ក្រៅម៉ោងបើក — អតិថិជនអាចមើល ប៉ុន្តែមិនអាចកុម្ម៉ង់។"),
    TEMP_CLOSED: tr("Ordering is paused (temporarily closed). Turn it back on in Settings.", "ការកុម្ម៉ង់ត្រូវបានផ្អាក។ បើកវិញនៅក្នុងការកំណត់។"),
    ORDERING_PAUSED: tr("Your plan has expired, so ordering is paused. Request a renewal in Billing.", "គម្រោងរបស់អ្នកផុតកំណត់ ការកុម្ម៉ង់ត្រូវបានផ្អាក។"),
    SUSPENDED: tr("This restaurant is suspended.", "ភោជនីយដ្ឋាននេះត្រូវបានផ្អាក។"),
  }[reason] || "";
}
