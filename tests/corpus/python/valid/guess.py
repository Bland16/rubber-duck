# covers: (none) beginner-style script with a while loop
import random

secret = random.randint(1, 100)
tries = 0
print("I'm thinking of a number between 1 and 100.")

while True:
    answer = input("Your guess (or 'q' to quit): ")
    if answer == "q":
        print("The number was", secret)
        break
    if not answer.isdigit():
        print("Please type a whole number.")
        continue
    guess = int(answer)
    tries += 1
    if guess < secret:
        print("Too low!")
    elif guess > secret:
        print("Too high!")
    else:
        print("Got it in", tries, "tries!" if tries != 1 else "try!")
        break
