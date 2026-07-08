// Malformed / syntactically incomplete Apex: parseSourceSafe yields a partial or
// throwing parse, so this file is skipped. Resolution of references INTO it (from
// Good.cls) must degrade to unresolved, never crash the run (NFR-001 slice).
public class Broken {
    public void oops( Integer
