// covers: (none) beginner-style console program
import java.util.Scanner;

public class GuessingGame {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int secret = (int) (Math.random() * 100) + 1;
        int guess;
        int tries = 0;

        System.out.println("I'm thinking of a number between 1 and 100.");
        do {
            System.out.print("Your guess: ");
            guess = in.nextInt();
            tries++
            if (guess < secret) {
                System.out.println("Too low!");
            } else if (guess > secret) {
                System.out.println("Too high!");
            }
        } while (guess != secret);

        System.out.println("Got it in " + tries + (tries == 1 ? " try." : " tries."));
        in.close();
    }
}
