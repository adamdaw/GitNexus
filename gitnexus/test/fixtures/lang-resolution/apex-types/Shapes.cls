public class Shapes {
    public Integer width;
    public String label { get; set; }

    public Shapes() {
        this.width = 0;
    }

    public Integer area() {
        return this.width * this.width;
    }

    public interface Drawable {
        void draw();
    }

    public enum Palette {
        RED,
        GREEN,
        BLUE
    }

    public class InnerBox {
        public Integer depth;

        public Integer volume() {
            return this.depth;
        }
    }
}
