// REQ-013: references whose targets are external (stdlib System, sObject Account, managed-package
// ExtNs.Svc) — none is user-defined in this repo. Each emits NO edge and NO unresolved *defect*:
// the host default on any unresolved reference (SDD-004 §1(4)/§2, RESEARCH-004 finding 6). No
// external-classification pass exists or is added.
public class ExtUser {
    public void go() {
        System.debug('x');           // stdlib static call
        Account a = new Account();   // sObject constructor
        String n = a.Name;           // sObject field access
        ExtNs.Svc.ping();            // managed-package namespace-qualified call
    }
}
