public class Overloads {
    public void f(Integer a) {}
    public void f(String a) {}

    public void g(List<Account> a) {}
    public void g(List<Contact> a) {}

    public void h(Account a) {}
    public void h(Account[] a) {}

    public Overloads(Integer a) {}
    public Overloads(String a) {}

    public void dup(Integer a) {}
    public void dup(Integer a) {}

    @TestVisible
    public Integer p, q, r;
}
