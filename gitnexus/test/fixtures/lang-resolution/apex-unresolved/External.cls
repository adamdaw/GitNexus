// REQ-015 / §4 external reference: a reference to a non-user-defined symbol
// (stdlib) -> unresolved, no Apex-specific defect (REQ-013 is WI-4, but the
// resolution slice must not throw on it).
public class External {
    public void use() {
        System.debug('hi');          // external stdlib -> unresolved, no throw
    }
}
