// The class half of the valid twin: the §3 exclusion drops the trigger from injection,
// so the class alone is injected — a cross-file Twin reference resolves to THIS type.
public virtual class Twin {
    public Twin() {}
    public static void stat2() {}
    public virtual void spin() {}
}
