import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phenova/screens/home_screen.dart';
import 'package:phenova/screens/explore_screen.dart';

void main() {
  testWidgets('HomeScreen builds CapCut-style shell', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: HomeScreen()),
      ),
    );
    await tester.pump(); // allow first frame
    // Bottom nav labels
    expect(find.text('Edit'), findsWidgets);
    expect(find.text('Templates'), findsWidgets);
    expect(find.text('AI Lab'), findsWidgets);
    expect(find.text('Projects'), findsWidgets);
    expect(find.text('Me'), findsWidgets);
    // Unique AI Editor entry on Edit tab
    expect(find.text('AI Editor'), findsWidgets);
    expect(find.text('New video'), findsWidgets);
  });

  testWidgets('ExploreScreen builds', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: ExploreScreen()));
    expect(find.textContaining('Explore'), findsWidgets);
  });
}
