// REQ-005 method-invocation case (SDD-002 §8: "a separate fixture supplies the
// method-invocation case"), case-varied via the seam, single declaration unit.
public class Calls {
    public class Service {
        public void run() {}
    }

    public void go() {
        SERVICE s = new service();
        s.RUN();                     // method invocation (CALLS run); case-varied
    }
}
