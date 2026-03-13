# Geonator

Geonator is an [Akinator](https://en.akinator.com/)-style location guessing game for places in Georgia.

## Algorithm (Minimal Overview)

- Start with all places as candidates with equal probability.
- Generate many possible yes/no questions.
- Score each question by information gain (how evenly it splits remaining candidates).
- Ask the best-scoring question.
- Update candidate probabilities using a Naive Bayes step from the user answer (`yes`, `no`, `probably`, `probably-not`, `unknown`).
- Repeat until one candidate is strongest, then guess.

## Screenshots

![image1](images/Screenshot%202026-03-12%20at%202.51.50 PM.png)
![image2](images/Screenshot%202026-03-12%20at%202.51.58 PM.png)
![image3}](images/Screenshot%202026-03-12%20at%202.52.30 PM.png)
![image4](images/Screenshot%202026-03-12%20at%202.55.39 PM.png)
![image5](images/Screenshot%202026-03-12%20at%202.55.47 PM.png)
_Images of the application in use._