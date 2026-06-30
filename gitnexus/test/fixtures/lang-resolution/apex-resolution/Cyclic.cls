// REQ-009 §4 cyclic / self-referential type chain WITHIN one declaration unit
// (`class Node { Node self; }`). Termination is the host field-access fixpoint's
// bounded convergence (iterates to a fixed cap, not the chain length): a deep
// self-chain must not hang or throw; the run completes.
public class Cyclic {
    public class Node {
        public Node self { get; set; }
    }

    public void walk() {
        Node n = new Node();
        Node deep = n.self.self.self.self.self.self;  // deep self-chain -> bounded termination, no hang
    }
}
