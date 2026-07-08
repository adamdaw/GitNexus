// Case-colliding members: a cross-file reference c.Act() matches both case-insensitively
// -> ambiguity reaches the resolver -> no edge + a positive suppressed record (REQ-015).
public class CaseColl {
    public void act() {}
    public void ACT() {}
}
