public class Annotated {
    @TestVisible private Integer secret;
    @AuraEnabled public String name { get; set; }

    @AuraEnabled(cacheable=true)
    public static String fetch() {
        return 'x';
    }

    @TestVisible
    public Annotated() {}

    @TestVisible
    @AuraEnabled
    @SomeUnknownAnno
    public Integer multiAnno;
}
